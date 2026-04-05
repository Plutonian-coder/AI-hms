"""
Compatibility Service — Weighted cosine similarity for roommate matching.

Eight lifestyle dimensions with weights derived from hostel conflict literature
(Adeniyi et al., 2024).
"""
import math

# Dimension weights — sum to 1.0
# Index: 0=Sleep, 1=Wake, 2=StudyNoise, 3=Cleanliness, 4=Visitors, 5=NightDevice, 6=Social, 7=NoiseTolerance
WEIGHTS = [0.20, 0.12, 0.15, 0.15, 0.07, 0.08, 0.05, 0.18]

DIMENSION_LABELS = [
    "Sleep Time", "Wake Time", "Study Noise", "Cleanliness",
    "Visitors", "Night Device Use", "Social Preference", "Noise Tolerance",
]


def weighted_cosine_similarity(vec_a: list, vec_b: list) -> float:
    """
    Compute weighted cosine similarity between two 8-dimensional lifestyle vectors.

    Returns a score between 0.0 (opposite) and 1.0 (perfect match).
    Handles zero vectors gracefully.
    """
    if len(vec_a) != 8 or len(vec_b) != 8:
        raise ValueError("Vectors must have exactly 8 dimensions")

    dot_product = 0.0
    mag_a = 0.0
    mag_b = 0.0

    for i in range(8):
        w = WEIGHTS[i]
        wa = w * float(vec_a[i])
        wb = w * float(vec_b[i])
        dot_product += wa * wb
        mag_a += wa * wa
        mag_b += wb * wb

    mag_a = math.sqrt(mag_a)
    mag_b = math.sqrt(mag_b)

    if mag_a == 0 or mag_b == 0:
        return 0.0

    return dot_product / (mag_a * mag_b)


def compute_room_compatibility(student_vector: list, occupant_vectors: list) -> float:
    """
    Compute the average weighted cosine similarity between a student and
    all existing occupants of a room.

    If the room is empty, returns 1.0 (perfect — no conflicts possible).
    Returns a percentage (0-100).
    """
    if not occupant_vectors:
        return 100.0

    total = 0.0
    for occ_vec in occupant_vectors:
        total += weighted_cosine_similarity(student_vector, occ_vec)

    avg = total / len(occupant_vectors)
    return round(avg * 100, 2)


def find_best_bed(student_vector: list, candidate_rooms: list) -> tuple:
    """
    Find the best bed across candidate rooms based on compatibility.

    Args:
        student_vector: The incoming student's 8-dim lifestyle vector
        candidate_rooms: List of dicts with keys:
            - bed_id: int
            - room_id: int
            - occupant_vectors: list of 8-dim vectors (empty if room is empty)

    Returns:
        (best_bed_id, best_room_id, best_score) or (None, None, 0) if no candidates
    """
    best_bed_id = None
    best_room_id = None
    best_score = -1.0

    for room in candidate_rooms:
        score = compute_room_compatibility(student_vector, room["occupant_vectors"])
        if score > best_score:
            best_score = score
            best_bed_id = room["bed_id"]
            best_room_id = room["room_id"]

    return best_bed_id, best_room_id, best_score
