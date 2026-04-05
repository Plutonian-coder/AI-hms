"""
Quiz Router — 8-question compatibility questionnaire + AI allocation trigger.

After the student submits answers, the system:
1. Stores the lifestyle vector in student_vectors
2. Queries candidate rooms across 3 hostel preferences
3. Computes weighted cosine similarity for each room
4. Allocates the best-scoring bed atomically
5. Stores pairwise compatibility scores

All streamed via SSE.
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List

from database import get_cursor, get_connection
from dependencies import get_current_student
from services.compatibility import compute_room_compatibility, weighted_cosine_similarity, find_best_bed
from services.audit_logger import log_event, QUIZ_SUBMITTED, BED_ALLOCATED

router = APIRouter(prefix="/api/v1/quiz", tags=["quiz"])

TOTAL_STEPS = 4


# ── SSE Helpers ──────────────────────────────────────────────────────────────

def _sse_step(step, status, title, detail):
    payload = json.dumps({"step": step, "total": TOTAL_STEPS, "status": status, "title": title, "detail": detail})
    return f"event: step\ndata: {payload}\n\n"

def _sse_error(step, title, detail):
    payload = json.dumps({"step": step, "total": TOTAL_STEPS, "title": title, "detail": detail})
    return f"event: error\ndata: {payload}\n\n"

def _sse_result(data):
    return f"event: result\ndata: {json.dumps(data)}\n\n"


# ── Questions (hardcoded — no DB needed) ─────────────────────────────────────

QUESTIONS = [
    {
        "id": 1, "dimension": "Sleep Time",
        "question": "What time do you usually go to sleep?",
        "options": [
            {"label": "Before 10 PM", "value": 1.0},
            {"label": "10 PM – Midnight", "value": 0.67},
            {"label": "After Midnight", "value": 0.33},
            {"label": "Very late, after 2 AM", "value": 0.0},
        ],
    },
    {
        "id": 2, "dimension": "Wake Time",
        "question": "What time do you usually wake up?",
        "options": [
            {"label": "Before 6 AM", "value": 1.0},
            {"label": "6 – 8 AM", "value": 0.67},
            {"label": "8 – 10 AM", "value": 0.33},
            {"label": "After 10 AM", "value": 0.0},
        ],
    },
    {
        "id": 3, "dimension": "Study Noise Preference",
        "question": "What environment do you study in?",
        "options": [
            {"label": "Complete silence required", "value": 0.0},
            {"label": "Low background noise is fine", "value": 0.33},
            {"label": "Music or noise is fine", "value": 0.67},
            {"label": "I study anywhere", "value": 1.0},
        ],
    },
    {
        "id": 4, "dimension": "Cleanliness",
        "question": "How do you keep your living space?",
        "options": [
            {"label": "Very tidy", "value": 1.0},
            {"label": "Reasonably tidy", "value": 0.67},
            {"label": "I clean when I have time", "value": 0.33},
            {"label": "Relaxed about mess", "value": 0.0},
        ],
    },
    {
        "id": 5, "dimension": "Visitors",
        "question": "How often do you have guests in your room?",
        "options": [
            {"label": "Never", "value": 0.0},
            {"label": "Occasionally, with notice", "value": 0.33},
            {"label": "Regularly", "value": 0.67},
            {"label": "My room is always open", "value": 1.0},
        ],
    },
    {
        "id": 6, "dimension": "Night Device Use",
        "question": "Do you use phone/laptop with lights on at night?",
        "options": [
            {"label": "Never", "value": 1.0},
            {"label": "Sometimes", "value": 0.67},
            {"label": "Often", "value": 0.33},
            {"label": "Yes, regularly", "value": 0.0},
        ],
    },
    {
        "id": 7, "dimension": "Social Preference",
        "question": "How do you prefer your room atmosphere?",
        "options": [
            {"label": "Quiet and private", "value": 0.0},
            {"label": "Calm with some interaction", "value": 0.33},
            {"label": "Fairly social", "value": 0.67},
            {"label": "Very social and lively", "value": 1.0},
        ],
    },
    {
        "id": 8, "dimension": "Noise Tolerance",
        "question": "How sensitive are you to noise?",
        "options": [
            {"label": "Very sensitive", "value": 0.0},
            {"label": "Somewhat sensitive", "value": 0.33},
            {"label": "Moderately tolerant", "value": 0.67},
            {"label": "I can sleep through anything", "value": 1.0},
        ],
    },
]


class QuizSubmit(BaseModel):
    answers: List[float]  # exactly 8 values, each 0.0–1.0


@router.get("/questions")
def get_questions():
    """Return the 8 compatibility questionnaire questions."""
    return {"questions": QUESTIONS}


@router.get("/status")
def get_quiz_status(student=Depends(get_current_student)):
    """Check if the student has completed the quiz for the current session."""
    with get_cursor() as cur:
        cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        sess = cur.fetchone()
        if not sess:
            return {"completed": False}

        cur.execute(
            "SELECT id FROM student_vectors WHERE student_id = %s AND session_id = %s",
            (student["user_id"], sess[0]),
        )
        return {"completed": cur.fetchone() is not None}


@router.post("/submit")
def submit_quiz(data: QuizSubmit, student=Depends(get_current_student)):
    """
    Submit the 8 lifestyle answers, store the vector, and trigger compatibility-based allocation.
    Streamed via SSE.
    """
    if len(data.answers) != 8:
        raise HTTPException(status_code=400, detail="Exactly 8 answers are required")

    for v in data.answers:
        if not (0.0 <= v <= 1.0):
            raise HTTPException(status_code=400, detail="All answers must be between 0.0 and 1.0")

    student_id = student["user_id"]
    student_vector = data.answers

    def pipeline():
        # ── Step 1: Save preferences ──
        yield _sse_step(1, "processing", "Saving Preferences", "Storing your lifestyle preferences...")

        with get_cursor() as cur:
            cur.execute("SELECT id, allocation_portal_open FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
            sess = cur.fetchone()

        if not sess:
            yield _sse_error(1, "Saving Preferences", "No active session found.")
            return

        session_id = sess[0]
        if not sess[1]:
            yield _sse_error(1, "Saving Preferences", "Allocation portal is currently closed.")
            return

        # Check confirmed payment exists
        with get_cursor() as cur:
            cur.execute(
                "SELECT id FROM confirmed_payments WHERE student_id = %s AND session_id = %s AND status = 'confirmed'",
                (student_id, session_id),
            )
            payment = cur.fetchone()

        if not payment:
            yield _sse_error(1, "Saving Preferences", "You need to complete payment first.")
            return

        payment_id = payment[0]

        # Check not already allocated
        with get_cursor() as cur:
            cur.execute(
                "SELECT id FROM allocations WHERE student_id = %s AND session_id = %s AND status = 'active'",
                (student_id, session_id),
            )
            if cur.fetchone():
                yield _sse_error(1, "Saving Preferences", "You already have an allocation for this session.")
                return

        # Check not already submitted quiz
        with get_cursor() as cur:
            cur.execute(
                "SELECT id FROM student_vectors WHERE student_id = %s AND session_id = %s",
                (student_id, session_id),
            )
            if cur.fetchone():
                yield _sse_error(1, "Saving Preferences", "You have already submitted the questionnaire.")
                return

        # Store vector
        v = student_vector
        with get_cursor() as cur:
            cur.execute(
                """INSERT INTO student_vectors (student_id, session_id, v1, v2, v3, v4, v5, v6, v7, v8)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (student_id, session_id, v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7]),
            )

        log_event(
            QUIZ_SUBMITTED, "student", student["identifier"],
            "Submitted compatibility questionnaire",
            target_entity="student_vector", session_id=session_id,
        )

        yield _sse_step(1, "complete", "Saving Preferences", "Lifestyle preferences saved")

        # ── Step 2: Find compatible rooms ──
        yield _sse_step(2, "processing", "Computing Compatibility", "Analyzing roommate compatibility...")

        # Get hostel choices from application
        with get_cursor() as cur:
            cur.execute(
                "SELECT choice_1_id, choice_2_id, choice_3_id FROM hostel_applications WHERE student_id = %s AND session_id = %s",
                (student_id, session_id),
            )
            choices_row = cur.fetchone()

        if not choices_row:
            yield _sse_error(2, "Computing Compatibility", "No hostel application found.")
            return

        # Get student gender for hostel matching
        gender = student["gender"]

        best_bed_id = None
        best_score = -1.0
        matched_preference = 0

        for pref_idx, hostel_id in enumerate(choices_row, start=1):
            if not hostel_id:
                continue

            # Get all rooms with vacant beds in this hostel
            with get_cursor() as cur:
                cur.execute("""
                    SELECT b.id as bed_id, r.id as room_id
                    FROM beds b
                    JOIN rooms r ON b.room_id = r.id
                    JOIN blocks bl ON r.block_id = bl.id
                    JOIN hostels h ON bl.hostel_id = h.id
                    WHERE bl.hostel_id = %s
                      AND b.status = 'vacant'
                      AND r.status = 'active'
                      AND bl.status = 'active'
                      AND h.status = 'active'
                    ORDER BY r.room_number, b.bed_number
                """, (hostel_id,))
                vacant_beds = cur.fetchall()

            if not vacant_beds:
                continue

            # Group by room and get occupant vectors
            rooms_map = {}
            for bed_id, room_id in vacant_beds:
                if room_id not in rooms_map:
                    rooms_map[room_id] = {"bed_id": bed_id, "room_id": room_id, "occupant_vectors": []}

            # Fetch occupant vectors for these rooms
            room_ids = list(rooms_map.keys())
            with get_cursor() as cur:
                for rid in room_ids:
                    cur.execute("""
                        SELECT sv.v1, sv.v2, sv.v3, sv.v4, sv.v5, sv.v6, sv.v7, sv.v8
                        FROM student_vectors sv
                        JOIN allocations a ON a.student_id = sv.student_id
                            AND a.session_id = %s AND a.status = 'active'
                        JOIN beds ob ON ob.id = a.bed_id AND ob.room_id = %s
                        WHERE sv.session_id = %s
                    """, (session_id, rid, session_id))
                    occ_rows = cur.fetchall()
                    rooms_map[rid]["occupant_vectors"] = [list(r) for r in occ_rows]

            candidate_rooms = list(rooms_map.values())
            bed_id, room_id, score = find_best_bed(student_vector, candidate_rooms)

            if bed_id and score > best_score:
                best_bed_id = bed_id
                best_score = score
                matched_preference = pref_idx

            # If we found a good match in a higher preference, use it
            if best_bed_id is not None:
                break

        if best_bed_id is None:
            yield _sse_error(2, "Computing Compatibility", "No beds available in your selected hostels. Please contact Student Affairs.")
            return

        yield _sse_step(2, "complete", "Computing Compatibility", f"Best match: {best_score:.1f}% compatibility")

        # ── Step 3: Atomic bed allocation ──
        yield _sse_step(3, "processing", "Securing Bed Space", "Locking your bed assignment...")

        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT allocate_specific_bed(%s, %s, %s, %s, %s, %s)",
                        (student_id, best_bed_id, session_id, payment_id, matched_preference, best_score),
                    )
                    allocation_id = cur.fetchone()[0]
                    conn.commit()
        except Exception as e:
            error_msg = str(e)
            if "already has an active allocation" in error_msg:
                yield _sse_error(3, "Securing Bed Space", "You already have an allocation.")
            elif "no longer available" in error_msg:
                yield _sse_error(3, "Securing Bed Space", "That bed was just taken. Please try again.")
            else:
                yield _sse_error(3, "Securing Bed Space", f"Allocation failed: {error_msg}")
            return

        yield _sse_step(3, "complete", "Securing Bed Space", "Bed secured!")

        # ── Step 4: Store compatibility scores + finalize ──
        yield _sse_step(4, "processing", "Finalizing", "Recording compatibility scores...")

        # Get the room_id of the allocated bed
        with get_cursor() as cur:
            cur.execute("SELECT room_id FROM beds WHERE id = %s", (best_bed_id,))
            alloc_room_id = cur.fetchone()[0]

            # Get all other occupants in this room
            cur.execute("""
                SELECT a.student_id, sv.v1, sv.v2, sv.v3, sv.v4, sv.v5, sv.v6, sv.v7, sv.v8
                FROM allocations a
                JOIN student_vectors sv ON sv.student_id = a.student_id AND sv.session_id = %s
                JOIN beds b ON b.id = a.bed_id AND b.room_id = %s
                WHERE a.session_id = %s AND a.status = 'active' AND a.student_id != %s
            """, (session_id, alloc_room_id, session_id, student_id))
            roommates = cur.fetchall()

        # Store pairwise scores
        with get_connection() as conn:
            with conn.cursor() as cur:
                for rm in roommates:
                    rm_id = rm[0]
                    rm_vec = list(rm[1:])
                    score = weighted_cosine_similarity(student_vector, rm_vec)
                    score_pct = round(score * 100, 2)
                    cur.execute(
                        """INSERT INTO compatibility_scores (student_a_id, student_b_id, session_id, score)
                           VALUES (%s, %s, %s, %s)
                           ON CONFLICT (student_a_id, student_b_id, session_id) DO NOTHING""",
                        (student_id, rm_id, session_id, score_pct),
                    )
                    # Also insert the reverse pair
                    cur.execute(
                        """INSERT INTO compatibility_scores (student_a_id, student_b_id, session_id, score)
                           VALUES (%s, %s, %s, %s)
                           ON CONFLICT (student_a_id, student_b_id, session_id) DO NOTHING""",
                        (rm_id, student_id, session_id, score_pct),
                    )

                # Update application status
                cur.execute(
                    "UPDATE hostel_applications SET status = 'allocated' WHERE student_id = %s AND session_id = %s",
                    (student_id, session_id),
                )
                conn.commit()

        log_event(
            BED_ALLOCATED, "student", student["identifier"],
            f"Allocated bed #{best_bed_id} with {best_score:.1f}% avg compatibility",
            target_entity="allocation", target_id=str(allocation_id),
            metadata={"bed_id": best_bed_id, "preference": matched_preference, "score": best_score},
            session_id=session_id,
        )

        yield _sse_step(4, "complete", "Finalizing", "Allocation complete!")

        # Return allocation details
        with get_cursor() as cur:
            cur.execute("""
                SELECT h.name, bl.name, r.room_number, b.bed_number
                FROM beds b
                JOIN rooms r ON r.id = b.room_id
                JOIN blocks bl ON bl.id = r.block_id
                JOIN hostels h ON h.id = bl.hostel_id
                WHERE b.id = %s
            """, (best_bed_id,))
            loc = cur.fetchone()

        yield _sse_result({
            "allocation_id": allocation_id,
            "hostel_name": loc[0],
            "block_name": loc[1],
            "room_number": loc[2],
            "bed_number": loc[3],
            "matched_from_preference": matched_preference,
            "avg_compatibility_score": best_score,
        })

    return StreamingResponse(pipeline(), media_type="text/event-stream")
