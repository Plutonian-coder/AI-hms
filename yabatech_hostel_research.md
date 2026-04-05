
DESIGN AND IMPLEMENTATION OF AN AI-DRIVEN HOSTEL MANAGEMENT SYSTEM WITH COMPATIBILITY-BASED ROOMMATE MATCHING AND SECURE PAYMENT INTEGRATION


BY

ZANNU RITA SENAMI
FPT/CSC/25/0130902


A PROJECT SUBMITTED TO THE DEPARTMENT OF COMPUTER SCIENCE,
FACULTY OF SCIENCE,
FEDERAL UNIVERSITY OYE-EKITI,
EKITI STATE, NIGERIA


SUPERVISOR
MR OLUKUMORO, S.O


JUNE, 2026

CERTIFICATION
This is to certify that this project report titled “Design and Implementation of an AI-Driven Hostel Management System with OCR-Based Eligibility Verification and Secure Payment Integration” was carried out by ZANNU RITA SENAMI (FPT/CSC/25/0130902) of the Department of Computer Science, Faculty of Science, Federal University Oye-Ekiti, Ekiti State, Nigeria, under the supervision of Mr Olukumoro, S.O, in partial fulfilment of the requirements for the award of the Bachelor of Science (B.Sc.) degree in Computer Science.


____________________________
Mr Olukumoro, S.O
(Project Supervisor)

____________________________
Head of Department
Department of Computer Science

____________________________
External Examiner

DEDICATION
This project is dedicated to God Almighty for His endless grace, and to my beloved family for their unwavering support, encouragement, and sacrifices throughout the course of this academic journey.

ACKNOWLEDGEMENT
All glory and honour are given to God Almighty for His mercy, protection, and guidance throughout this academic programme. His grace has been sufficient from the beginning to the completion of this project work.
Sincere appreciation is extended to my project supervisor, Mr Olukumoro, S.O, for his invaluable guidance, constructive criticism, and patience throughout the development of this research. His expertise and mentorship were instrumental to the successful delivery of this project.
Profound gratitude is also expressed to the Head of Department, Computer Science, and to all the academic and non-academic staff members of the department for the knowledge they imparted and the conducive learning environment they provided throughout the duration of this programme.
Special thanks are extended to my parents and family members for their moral and financial support, which sustained this academic pursuit. Their belief in my abilities served as a constant source of motivation and strength.
Finally, appreciation is given to my friends, classmates, and all those who contributed in one way or another to the successful completion of this project. May God bless you all.

ABSTRACT

The management of student hostel accommodation in Nigerian federal universities remains predominantly manual, characterised by the absence of real-time institutional identity verification, opaque single-figure fee structures, random bed assignment with no consideration of roommate compatibility, and a complete lack of administrative audit trails. These deficiencies result in financial discrepancies, documented roommate conflicts that affect academic performance, and institutional accountability gaps. This project presents the design and implementation of an AI-driven hostel management system that addresses these challenges through four integrated technical innovations. First, a session-scoped student register import mechanism enables administrators to upload a CSV of enrolled students, against which every registration attempt is validated, ensuring that only currently enrolled students access the platform. Second, a multi-component fee builder allows administrators to define named hostel fee components per study type and academic session, with the Paystack payment gateway integrated as the sole payment pathway and automatic generation of session-scoped HMS receipt references upon payment confirmation. Third, an AI-powered roommate compatibility matching algorithm employing weighted cosine similarity on eight-dimensional student lifestyle vectors replaces random bed assignment with preference-weighted, compatibility-optimised allocation, protected by PostgreSQL row-level concurrency control via SELECT FOR UPDATE SKIP LOCKED. Fourth, an immutable, append-only audit trail records twenty-two categories of significant system events, providing the digital equivalent of the physical register maintained in legacy hostel offices. The system was developed using React.js 19 with Vite and TailwindCSS 4 for the frontend, Python FastAPI for the backend, PostgreSQL on Supabase as the database layer, the Paystack API for payment processing, NumPy for vector computation, and the Google Gemini API for natural language query processing. Functional testing confirmed that all eight project objectives were met, with edge case scenarios including concurrent allocation attempts, closed portal access, and mutation-attempt rejection in the natural language query module all passing successfully. The system demonstrates that the integration of weighted similarity matching, institutional register verification, and structured administrative reporting within a single unified platform constitutes a viable and scalable framework for modernising hostel management in Nigerian tertiary institutions.

TABLE OF CONTENTS
CERTIFICATION	2
DEDICATION	3
ACKNOWLEDGEMENT	4
CHAPTER ONE: INTRODUCTION	8
1.1 Background of the Study	8
1.2 Statement of the Problem	9
1.3 Aim and Objectives of the Study	11
1.4 Significance of the Study	12
1.5 Scope of the Study	14
1.6 Definition of Terms	15
CHAPTER TWO: LITERATURE REVIEW	19
2.1 Introduction	19
2.2 Conceptual Review	20
2.2.1 The Concept of Hostel Management Systems	20
2.2.2 AI-Based Compatibility Matching in Shared Accommodation	21
2.2.3 Digital Payment Integration in Nigerian Institutional Platforms	22
2.2.4 Administrative Accountability and Audit Trails	23
2.3 Review of Related Technologies	24
2.4 Review of Existing Systems	26
2.4.1 Traditional Manual Hostel Management	26
2.4.2 Basic CRUD Web Portals	27
2.4.3 Commercial Hostel Management Platforms	28
2.5 Summary of Literature	28
CHAPTER THREE: SYSTEM ANALYSIS AND DESIGN	30
3.1 Introduction	30
3.2 Analysis of the Existing System	30
3.2.1 Problems of the Existing System	30
3.3 Description of the Proposed System	31
3.3.1 Advantages of the Proposed System	32
3.4 System Design	33
3.4.1 System Architecture	33
3.4.2 Database Design (Data Dictionary)	34
3.4.3 Input Design	43
3.4.4 Output Design	46
3.4.5 System Flowchart and Algorithm Logic	48
CHAPTER FOUR: SYSTEM IMPLEMENTATION AND EVALUATION	51
4.1 Introduction	51
4.2 System Requirements	51
4.2.1 Hardware Requirements	51
4.2.2 Software Requirements	52
4.3 Choice of Programming Languages	52
4.4 Implementation Details	54
4.4.1 Authentication Module	54
4.4.2 Session Register Import Module	54
4.4.3 Multi-Component Fee and Payment Module	55
4.4.4 Compatibility Matching Module	56
4.4.5 Atomic Bed Allocation	56
4.4.6 Admin Natural Language Query	57
4.4.7 Audit Trail	57
4.4.8 Report Builder	58
4.5 System Testing	59
CHAPTER FIVE: SUMMARY, CONCLUSION, AND RECOMMENDATIONS	62
5.1 Summary	62
5.2 Conclusion	63
5.3 Recommendations	64
REFERENCES	66

CHAPTER ONE: INTRODUCTION
1.1 Background of the Study
Student hostel accommodation constitutes a critical component of the tertiary education experience in Nigeria, serving not merely as a residential facility but as a determinant of academic performance, social integration, and institutional retention. Research has established a documented relationship between the quality of student housing management and academic outcomes, with Olatunji, Adebisi, and Oluwole (2021) demonstrating that students housed in well-managed hostels with compatible roommates consistently achieved higher grade point averages than those subjected to random or poorly administered allocation processes. In the Nigerian federal university system, where the demand for hostel spaces routinely exceeds available supply by significant margins, the administrative pressure on Student Affairs Units to allocate beds efficiently, transparently, and equitably has intensified with each academic session.
The prevailing hostel management practice in most Nigerian federal universities, including the Federal University Oye-Ekiti, relies on manual processes that have remained fundamentally unchanged for decades. Students are required to present themselves physically at the Student Affairs Unit with paper documentation, undergo manual verification of their enrollment status through physical register inspection, pay hostel fees through processes that generate paper receipts with limited traceability, and receive bed assignments that are either random or determined by a first-come-first-served queue. This manual paradigm is not merely inefficient; it is structurally incapable of addressing the contemporary challenges of scale, accountability, and fairness that define hostel management in a modern university.
Recent advances in web application technologies and artificial intelligence offer transformative solutions to these entrenched challenges. Specifically, weighted similarity algorithms drawn from the field of computational social science can replace random bed assignment with compatibility-optimised roommate matching. Secure digital payment gateways, such as the Paystack API, can replace unverifiable paper receipts with cryptographically verified transaction records. Institutional identity verification through a session-scoped student register, imported and maintained by administrative staff, can replace the physical bursary clearance queue with an automated, real-time validation mechanism. Furthermore, append-only audit trail systems, implemented at the database permission level, can provide the institutional accountability that legacy physical registers were designed to deliver, but with superior searchability, export capability, and tamper resistance.
It is within this context that the present study was conceived. The AI-Driven Hostel Management System presented in this project represents a direct response to the documented failures of manual hostel administration, employing a combination of artificial intelligence, secure payment integration, institutional identity verification, and administrative accountability mechanisms to deliver a platform that is transparent, auditable, compatibility-aware, and operationally aligned with the administrative structure of Nigerian federal universities.
1.2 Statement of the Problem
The existing manual hostel management system at Nigerian federal universities, including the Federal University Oye-Ekiti, exhibits four critical failure modes that collectively undermine the efficiency, fairness, transparency, and accountability of the accommodation allocation process.
The first failure mode is the absence of real-time institutional identity verification. Under the current system, students self-declare their personal details, including their names, matriculation numbers, levels, departments, and study types, during the hostel application process. No automated mechanism exists to confirm that a student is genuinely enrolled in the current academic session, that the details provided are accurate, or that the student has not previously registered under a different identity. This verification gap creates opportunities for unauthorised access to hostel services and imposes a manual cross-checking burden on administrative staff that is both time-consuming and error-prone.
The second failure mode concerns the fragmented and opaque fee structure. Hostel fees in Nigerian universities are not a single charge but a composition of multiple named components, including accommodation, room upkeep, electricity levy, water levy, caution deposit, bedding levy, security levy, and development levy, each of which may vary by study type and student level. Under the manual system, these components are communicated informally, often as a single undifferentiated total, creating frequent disputes between students and the bursary department. Students cannot verify what they were charged, and the bursary cannot trace individual fee components to specific payments. Adebayo and Smith (2022) documented that the reliance on paper receipts in Nigerian university hostel systems is a primary cause of financial discrepancy and audit failure.
The third failure mode is the random or first-come-first-served bed allocation approach, which assigns students to rooms with no consideration of lifestyle compatibility. Research by Adeniyi, et al. (2024) established a systematic link between roommate compatibility and academic outcomes in Nigerian university hostels, demonstrating that mismatched sleep schedules, noise tolerance levels, and cleanliness standards are the primary documented sources of roommate conflict. Despite this evidence, no deployed Nigerian university hostel system integrates a compatibility-based allocation mechanism.
The fourth failure mode is the complete absence of an institutional audit trail. When an administrator revokes an allocation, opens or closes a portal, modifies fee components, or overrides a system decision, these actions are unrecorded. The physical registers maintained in legacy hostel offices were designed to serve this accountability function, but they are neither searchable nor exportable, and they are susceptible to loss, damage, and selective recording. The result is an accountability gap that affects institutional governance and erodes trust among students, parents, and regulatory bodies.
1.3 Aim and Objectives of the Study
Aim: The aim of this study is to design and implement an AI-driven hostel management system that automates institutional identity verification through a session-scoped student register, integrates secure multi-component fee payment via the Paystack gateway, employs a weighted cosine similarity algorithm for compatibility-based roommate matching, and provides an immutable audit trail and a structured report builder for administrative accountability and transparency.

The specific objectives of the study are as follows:
1. To implement institutional identity verification by enabling administrators to import a session-specific student register CSV, against which student matric numbers are validated at the point of registration, preventing unauthorised access to the platform.
2. To design a multi-component fee builder that allows administrators to define named hostel fee components per study type and academic session, ensuring transparent and auditable charges aligned with the actual structure of Nigerian university hostel billing.
3. To integrate the Paystack payment gateway as the sole payment pathway, with automatic generation of a session-scoped HMS receipt reference upon payment confirmation, replacing unverifiable paper receipts entirely.
4. To implement an AI-powered roommate compatibility matching system using weighted cosine similarity on eight-dimensional student lifestyle vectors, replacing random bed assignment with preference-weighted, compatibility-optimised allocation protected by PostgreSQL row-level concurrency control.
5. To develop a secondary AI feature in the administrative dashboard whereby administrators may query system data using plain English, with the Google Gemini API generating validated, read-only SQL queries against the live database schema.
6. To implement an immutable, append-only audit trail recording all twenty-two categories of significant system events with actor, timestamp, and contextual metadata, providing the digital equivalent of the physical register maintained in legacy hostel offices.
7. To build a structured report builder enabling administrators to construct custom data extracts by selecting filters and table columns from a predefined catalogue that correlates across all system data domains, with live preview and CSV export.
8. To evaluate the system through comprehensive functional testing covering both normal operation scenarios and edge cases including concurrent allocation attempts, closed portal access, study type fee mismatch, and invalid CSV import formats.



1.4 Significance of the Study
The significance of this study extends across four distinct stakeholder groups within the Nigerian university ecosystem. For the Student Affairs Unit, the system eliminates the manual workload associated with identity verification and bed assignment by fully automating both processes. The session register import mechanism ensures that only students confirmed as enrolled by the university’s ICT department can access the hostel platform, removing the need for physical queue-based verification. The compatibility-weighted allocation algorithm assigns beds without administrative intervention, freeing hostel officers to focus on welfare, maintenance, and policy rather than clerical allocation tasks.
For the Bursary and Financial Services Department, the system replaces paper receipts with cryptographically verified payment records through the Paystack gateway. Each payment generates a session-scoped HMS receipt reference that is traceable, exportable, and linked to an itemised breakdown of every fee component paid. This provides a single source of financial truth for auditing, reconciliation, and reporting purposes. The multi-component fee structure ensures that charges are transparent and defensible, eliminating the disputes that arise when students receive a single undifferentiated total with no explanation of its composition.
For students, the system delivers a fair, transparent, and compatibility-aware allocation experience. The weighted cosine similarity algorithm ensures that bed assignments are optimised for lifestyle compatibility rather than determined by arrival time or administrative discretion. The entire process, from registration to allocation, is completable remotely via a web browser, eliminating the need for physical visits to the hostel office. Students can verify their fee breakdown before payment, view their compatibility scores with assigned roommates after allocation, and access a printable HMS receipt at any time.
For the academic and research community, this study provides a documented case of applying weighted similarity matching and institutional register verification to solve a real administrative problem specific to the Nigerian university context. The literature review conducted for this project confirms that no existing deployed Nigerian university system combines compatibility-based allocation, session register verification, multi-component fee management, and an immutable audit trail in a single unified platform. This project therefore contributes a novel and replicable framework to the body of knowledge on institutional information systems in Nigerian tertiary education.
1.5 Scope of the Study
The scope of this study encompasses the design, development, and evaluation of the AI-Driven Hostel Management System as a web-based platform with nineteen screens distributed across three access layers: three public pages, eight student portal pages, and eight administrative portal pages. The system covers student registration with session register verification, multi-component fee payment via the Paystack gateway with auto-generated HMS receipt references, an eight-question lifestyle compatibility questionnaire, the weighted cosine similarity bed allocation algorithm, administrative management of academic sessions including the fee component builder and portal lifecycle controls, hostel infrastructure management across the four-level hierarchy of hostel, block, room, and bed, student record management with revocation capability, the immutable audit trail with twenty-two event types, and the structured report builder with a comprehensive filter and column catalogue.
The system is configured for University (BSc) mode with the Federal University Oye-Ekiti as the reference institution, supporting student levels from 100-Level through 500-Level and three study types: Full-time, Part-time, and Sandwich. However, the architecture is institution-agnostic and configurable at deployment for Polytechnics (ND1, ND2, HND1, HND2 levels) and Colleges of Education (NCE1, NCE2, NCE3 levels). The session context for all examples and test cases in this report is the 2025/2026 academic session.
1.6 Definition of Terms
Weighted Cosine Similarity: A mathematical measure of the similarity between two non-zero vectors in a multi-dimensional space, extended with dimension-specific weights to reflect the relative importance of each dimension in determining overall similarity. In this system, it is used to compare eight-dimensional student lifestyle vectors, with weights derived from hostel conflict literature.
Lifestyle Vector: An ordered array of eight normalised decimal values, each between 0.0 and 1.0, representing a student’s self-reported preferences across eight lifestyle dimensions: sleep time, wake time, study noise preference, cleanliness, visitor frequency, night device use, social preference, and noise tolerance.
Allocation Algorithm: The computational procedure, implemented as a PostgreSQL stored function named allocate_bed(), that evaluates all candidate rooms across a student’s three ranked hostel preferences, computes the average weighted cosine similarity between the incoming student and each room’s existing occupants, and assigns the student to the highest-scoring available bed.
Paystack: A Nigerian financial technology company that provides a payment processing gateway enabling businesses and institutions to accept payments via card, bank transfer, USSD, and mobile money channels through a secure, PCI-compliant API.
Session Register: A CSV file containing the official list of students enrolled in a specific academic session, imported by an administrator into the system’s session_register database table. Each record includes the student’s matriculation number, surname, first name, gender, department, level, and study type.
HMS Receipt Reference: A system-generated unique payment reference in the format HMS/YYYY/XXXXX, where YYYY is derived from the active academic session and XXXXX is a zero-padded sequential number. This reference replaces the traditional paper receipt as the official proof of hostel fee payment.
FastAPI: A modern, high-performance Python web framework for building APIs, based on standard Python type hints, supporting asynchronous request handling through the ASGI specification, and providing automatic request validation through Pydantic models.
React.js: A JavaScript library for building user interfaces through a component-based architecture, utilising a Virtual DOM for efficient rendering and supporting declarative state management through hooks.
PostgreSQL: An advanced open-source relational database management system known for its robustness, extensibility, and support for complex features including stored functions, row-level security, JSONB data types, and advanced concurrency control mechanisms.
Supabase: A backend-as-a-service platform providing managed PostgreSQL database hosting, authentication services, and real-time subscriptions, used in this project as the cloud hosting provider for the PostgreSQL database.
JWT (JSON Web Token): An open standard for securely transmitting information between parties as a JSON object, digitally signed using a secret key. In this system, JWTs are used for stateless authentication, encoding the user’s identity, role, and session expiry into a token issued at login and validated on every subsequent request.
SSE (Server-Sent Events): A server push technology enabling a server to send real-time updates to a client over a single HTTP connection. In this system, SSE is used to stream payment verification steps to the student’s browser during the payment callback process.
Audit Trail: An immutable, chronological record of all significant system events, stored in an append-only database table with no update or delete permissions granted to the application user. Each record captures the actor, action type, target entity, timestamp, and contextual metadata.
Report Builder: A structured, form-driven administrative tool that allows the construction of custom data extracts by selecting filters and display columns from a predefined catalogue, with live preview and CSV export capability.
Study Type: The mode of academic programme enrolment, determining fee amounts and levy applicability. Valid values in University (BSc) mode are Full-time, Part-time, and Sandwich.
Fee Component: A named, individually priced element of the total hostel fee, defined per academic session with separate amounts for each study type. Examples include Accommodation, Room Upkeep, Electricity Levy, and Caution Deposit.
Portal Toggle: An administrative control that opens or closes a specific phase of the hostel management lifecycle, such as the application portal, payment portal, or allocation portal. Each toggle change is recorded in the audit trail.
Row-Level Locking (SELECT FOR UPDATE SKIP LOCKED): A PostgreSQL concurrency control mechanism that locks a specific database row during a transaction, preventing other concurrent transactions from modifying or locking the same row. The SKIP LOCKED clause causes competing transactions to skip already-locked rows rather than waiting, ensuring that concurrent allocation attempts do not produce deadlocks or double bookings.

CHAPTER TWO: LITERATURE REVIEW
2.1 Introduction
This chapter presents a comprehensive review of the literature relevant to the design and implementation of the AI-Driven Hostel Management System. The review is organised into four thematic areas that collectively provide the theoretical, technological, and empirical foundation for the project. The first area examines the concept of hostel management systems in Nigerian tertiary institutions, establishing the documented gap between demand and supply and the administrative challenges that arise from this imbalance. The second area reviews AI-based compatibility matching approaches for shared accommodation, tracing the academic lineage from classical stable matching theory to modern similarity-based methods and identifying the specific gap that this project addresses. The third area discusses secure digital payment integration in institutional platforms, with particular attention to the Nigerian context where the Remita and Paystack gateways serve distinct operational roles. The fourth area reviews administrative accountability systems, examining the transition from physical registers to digital audit trails and the implications for institutional governance. The chapter concludes with a review of related technologies, an analysis of existing systems, and a summary that synthesises the key findings and confirms the gap that the proposed system addresses.



2.2 Conceptual Review
2.2.1 The Concept of Hostel Management Systems
A hostel management system in the context of tertiary education refers to any organised framework, whether manual or automated, that governs the allocation, administration, and monitoring of student residential accommodation. The scope of such a system encompasses student eligibility verification, fee collection, bed assignment, occupancy tracking, maintenance coordination, and administrative reporting. In its most basic form, a hostel management system consists of a physical register maintained by hostel officers, a payment receipt verification process conducted by the bursary, and a bed chart updated manually as students are assigned to rooms.
In Nigerian federal universities, the challenge of hostel management is intensified by the documented gap between demand and supply. Adebayo and Smith (2022) reported that the ratio of available hostel beds to enrolled students in many Nigerian federal universities falls below one bed for every five eligible students, creating intense competition for limited spaces and placing extraordinary administrative pressure on the units responsible for allocation. This scarcity transforms hostel allocation from a routine administrative function into a high-stakes process where perceived unfairness can generate significant student unrest and institutional reputational damage.
The limitations of basic CRUD (Create, Read, Update, Delete) operations in addressing the complexity of modern hostel management have become increasingly apparent. A system that merely digitises record-keeping without introducing automated verification, algorithmic allocation, or centralised financial records offers only marginal improvement over the manual process it replaces. Olatunji et al. (2021) argued that modern hostel management systems must integrate identity verification, transparent fee structures, and evidence-based allocation mechanisms to deliver meaningful improvements in both administrative efficiency and student satisfaction.

2.2.2 AI-Based Compatibility Matching in Shared Accommodation
The problem of matching individuals to shared living spaces has a well-established academic lineage. The foundational work of Gale and Shapley (1962) on the stable matching problem, originally formulated in the context of college admissions and marriage, demonstrated that it is possible to find stable pairings in which no two unmatched individuals would prefer each other to their assigned partners. While the Gale-Shapley algorithm addressed stability, it did not incorporate the notion of compatibility as a continuous, multi-dimensional metric, which is the approach required for roommate matching where lifestyle similarity, rather than mutual preference ranking, is the relevant criterion.
Modern approaches to roommate matching have moved beyond discrete preference rankings to embrace vector-based similarity metrics. Rahman and Manoj Kumar (2021) proposed an optimal room and roommate matching system using a nearest neighbours algorithm with cosine similarity distribution, demonstrating that cosine similarity on lifestyle feature vectors can identify compatible roommate groupings more effectively than random assignment or simple preference ranking. Their work established the mathematical viability of cosine similarity as a matching metric for shared accommodation but did not address the specific dimensional weights required for different cultural and institutional contexts.
Zhang et al. (2024) explored a more computationally intensive approach, proposing a personalised dormitory roommate matching system based on multiple swarm genetic algorithms. Their framework demonstrated superior matching quality in large-scale simulations but introduced computational complexity that may not be justified in the operational context of a Nigerian university hostel system where the number of students per session is typically in the hundreds rather than the thousands.
Adeniyi et al. (2024) provided the most directly relevant contribution to this project by exploring the link between roommate compatibility and academic outcomes specifically in Nigerian university hostels. Their systematic review identified sleep schedule alignment, noise tolerance, and cleanliness standards as the three highest-impact compatibility dimensions in the Nigerian context, findings that directly informed the dimension weighting scheme adopted in the present system. Critically, Adeniyi et al. (2024) noted that despite the documented impact of roommate compatibility on academic performance, no deployed Nigerian university system integrates a compatibility-based allocation mechanism. This gap constitutes the direct contribution of the present study.
2.2.3 Digital Payment Integration in Nigerian Institutional Platforms
The digital payment landscape in Nigerian tertiary institutions is dominated by the Remita platform, which serves as the primary gateway for school fees, acceptance fees, and other statutory charges across federal institutions. Oyekanmi (2023) documented the role of Remita in standardising fee collection across Nigerian universities, noting that its Remita Retrieval Reference (RRR) system provides a traceable payment identifier that has largely replaced paper receipts for school fees. However, Remita’s integration model is institution-driven and requires formal agreements between the university and the payment platform, making it less accessible for ancillary systems developed as student projects or departmental initiatives.
The Paystack payment gateway offers a developer-accessible alternative with a well-documented API, webhook-based verification, and support for multiple payment channels including card, bank transfer, USSD, and mobile money. Paystack’s transaction lifecycle follows a clear initialisation, authorisation, and verification pattern that is well-suited to integration with web applications. The webhook verification mechanism, in particular, provides a server-to-server confirmation path that does not depend on the student’s browser completing a redirect, offering a reliability advantage over pure client-side callback approaches.
Adebayo and Smith (2022) established that the reliance on paper receipts in Nigerian university hostel systems is a documented cause of financial discrepancy, noting that paper receipts are susceptible to loss, forgery, and selective recording. The transition from paper receipts to digitally verified payment records, with each transaction linked to an itemised breakdown of fee components, addresses this documented vulnerability and provides an auditable financial trail that serves the interests of both students and the bursary department.
2.2.4 Administrative Accountability and Audit Trails
The principle of administrative accountability through record-keeping is foundational to institutional governance. In legacy hostel management systems, accountability is maintained through physical registers in which hostel officers record allocation decisions, fee receipts, room changes, and disciplinary actions. These registers serve as the institutional memory of the hostel administration and provide a reference point for resolving disputes, conducting audits, and ensuring continuity across administrative transitions.
Digital audit trails extend this principle by providing searchability, export capability, and tamper resistance that physical registers cannot offer. Chen and Mensah (2022) documented the role of audit logging in multi-tier administrative portals, establishing that append-only event logs with structured metadata enable real-time monitoring, historical analysis, and regulatory compliance reporting. Their work emphasised that the immutability of audit records must be enforced at the database permission level, not merely at the application level, to prevent circumvention by privileged users or compromised application code.
The audit trail implemented in the present system adopts this database-level immutability approach, with the application database user granted INSERT-only permissions on the audit_logs table and no UPDATE or DELETE permissions. This ensures that any attempt to alter an audit record results in a database-level permission error rather than a silent modification, providing a structural guarantee of record integrity that is independent of application logic.
2.3 Review of Related Technologies
This section provides academic overviews of the core technologies employed in the development of the AI-Driven Hostel Management System. Each technology is discussed in terms of its architectural principles, its specific role in the system, and the academic or industry rationale for its selection.
React.js is a JavaScript library for building user interfaces, maintained by Meta and a community of developers. React employs a component-based architecture in which the user interface is decomposed into reusable, self-contained components, each managing its own state and rendering logic. The Virtual DOM mechanism enables efficient updates by computing the minimal set of actual DOM changes required when state changes occur, reducing the performance cost of frequent re-renders. In the present system, React.js version 19 serves as the frontend framework, with React Router version 7 providing client-side routing for the nineteen-page single-page application. The Recharts and Chart.js libraries are utilised for dashboard visualisations, including bar charts, line charts, doughnut charts, and the radar chart used to display compatibility profiles.
Python with FastAPI constitutes the backend technology stack. Python’s dominance in the artificial intelligence and machine learning ecosystem, including native support for NumPy vector computation and the google-generativeai SDK, made it the natural choice for a system that integrates AI-driven matching. FastAPI is a modern, high-performance ASGI framework that provides automatic request validation through Pydantic models, native support for asynchronous request handling, and built-in SSE streaming capability used in the payment callback flow. The deployment configuration uses Gunicorn with Uvicorn workers on the Render cloud platform, enabling concurrent request handling suitable for institutional-scale traffic.
PostgreSQL serves as the relational database management system, hosted on the Supabase cloud platform. PostgreSQL’s support for stored functions enables the encapsulation of the allocation algorithm in a single atomic database transaction, ensuring that the compatibility computation, bed locking, allocation insertion, and compatibility score recording either all succeed or all fail as a unit. The SELECT FOR UPDATE SKIP LOCKED mechanism provides the concurrency control required to prevent double-booking when multiple students attempt allocation simultaneously. The JSONB data type is used in the audit_logs table to store flexible metadata payloads without requiring schema changes for each new event type. The append-only permission model, enforced by granting only INSERT permission on the audit_logs table to the application database user, provides the structural immutability guarantee for the audit trail.
The Paystack API provides the payment processing infrastructure. The Paystack transaction lifecycle follows a three-phase pattern: initialisation (the backend sends a request to Paystack with the payment amount and callback URL, receiving an authorisation URL in return), authorisation (the student completes payment on the Paystack-hosted checkout page), and verification (the backend verifies the transaction status and amount through either the callback redirect or the webhook endpoint). The webhook endpoint provides a server-to-server verification path that is independent of the student’s browser, ensuring payment confirmation even if the redirect fails.
The Google Gemini API is utilised for two distinct purposes in the system. First, it generates a natural language match summary sentence displayed on the student’s allocation page, transforming raw compatibility scores into an explainable, human-readable description of the matching rationale. Second, it powers the natural language query feature on the administrative dashboard, where administrators can type plain English questions about system data and receive structured results. The Gemini API receives the database schema as context, generates a read-only SELECT SQL query, which the backend validates as SELECT-only before execution.
NumPy is the Python library used for the core vector computation in the compatibility matching algorithm. The weighted cosine similarity calculation between student lifestyle vectors is implemented using NumPy’s array operations, providing efficient in-process computation without the latency or cost of an external machine learning service.
2.4 Review of Existing Systems
2.4.1 Traditional Manual Hostel Management
The traditional manual hostel management system, still operational at many Nigerian federal universities, follows a sequential process that begins with a physical clearance queue at the Student Affairs Unit. Students present identification documents, enrollment confirmation letters, and bursary payment receipts to hostel officers who manually verify each item against physical registers. Upon clearance, the student is assigned to a room by consulting a physical bed chart, a large poster or board on which room numbers and bed statuses are indicated with manual markings. Adebayo and Smith (2022) documented that this process is characterised by transparency failures arising from the opaque nature of physical registers, which are not accessible to students and cannot be audited remotely. Olatunji et al. (2021) demonstrated the negative academic impact of poor housing management practices, establishing that students who experienced prolonged delays in the manual allocation process or who were assigned incompatible roommates exhibited measurably lower academic performance than their peers in well-managed accommodation.
2.4.2 Basic CRUD Web Portals
Several Nigerian universities have adopted basic web portals that digitise certain aspects of hostel management, typically allowing students to view available hostels, submit applications online, and check allocation status. However, these portals generally lack the four critical features that define the contribution of the present system. They do not verify student identity against a live session register, relying instead on self-declared information. They do not implement compatibility-based allocation, defaulting to either random assignment or first-come-first-served logic. They do not provide itemised, transparent fee structures, presenting hostel fees as a single undifferentiated amount. And they do not maintain immutable audit trails, leaving administrative actions unrecorded and unaccountable. Adeyemi and Smith (2023) evaluated the usability of Nigerian academic portals and identified high form abandonment rates, poor error messaging, and a lack of progress feedback as common design failures, findings that informed the progress stepper and SSE streaming design decisions in the present system.

2.4.3 Commercial Hostel Management Platforms
Commercial platforms such as SpaceBasic, which is deployed in Indian university contexts, and StarRez, which is widely used in universities in the United States, represent the current state of the art in hostel management technology. These platforms offer comprehensive features including online application management, payment processing, room assignment optimisation, and administrative reporting. However, neither platform is designed for the Nigerian institutional context. They do not accommodate the Remita-based fee payment infrastructure that underpins Nigerian university financial operations. They do not support the study type distinctions (Full-time, Part-time, Sandwich) that are central to the Nigerian university structure and that determine fee component applicability. And they do not provide the session register verification mechanism that addresses the specific identity verification challenge documented in Nigerian institutions. The present system is purpose-built for the Nigerian context, with every design decision, from the fee component builder to the session register import to the institution type configuration, informed by the operational realities of Nigerian federal university administration.
2.5 Summary of Literature
The literature review has established three key findings that collectively define the gap addressed by the present system. First, the demand-supply imbalance in Nigerian university hostels creates intense administrative pressure that manual systems are structurally incapable of managing efficiently, transparently, or fairly. Second, weighted similarity-based roommate matching has been demonstrated in the literature to produce measurably better compatibility outcomes than random assignment, yet no deployed Nigerian university system implements such an approach. Third, the transition from paper-based to digital accountability mechanisms, including cryptographically verified payment records and append-only audit trails, addresses documented transparency failures in legacy hostel administration. The proposed AI-Driven Hostel Management System integrates session-register-based identity verification, weighted cosine similarity roommate matching, Paystack-verified multi-component fee payment, and a structured administrative report builder in a single unified platform. No existing system in the Nigerian university context combines these four capabilities, confirming the novelty and contribution of this project.

CHAPTER THREE: SYSTEM ANALYSIS AND DESIGN
3.1 Introduction
This chapter presents the analysis of the existing manual hostel management system, the description and advantages of the proposed system, and the detailed system design encompassing architecture, database design, input design, output design, and algorithmic logic. The design specifications documented in this chapter are sourced directly from the system scope and implementation guide and represent the finalised technical blueprint from which the implementation described in Chapter Four was executed.
3.2 Analysis of the Existing System
The existing hostel management system at a typical Nigerian federal university follows a manual, sequential workflow administered by the Student Affairs Unit in coordination with the Bursary and Financial Services Department. Students seeking hostel accommodation must physically present themselves at the Student Affairs office, submit identification documents for manual verification against a physical enrollment register, obtain and present a paper payment receipt from the bursary confirming hostel fee payment, and await manual bed assignment from a physical bed chart maintained by hostel officers. Administrative records are kept in physical registers that are neither searchable, exportable, nor accessible to students for verification purposes.
3.2.1 Problems of the Existing System
The existing manual system exhibits six documented problems. First, the absence of real-time institutional identity verification means that student details are self-declared and cross-checked manually against physical registers, a process that is both time-consuming and susceptible to error and fraud. Second, opaque single-figure fee charging, in which hostel fees are communicated as an undifferentiated total without itemisation of individual components, prevents students and auditors from verifying what was charged and creates documented financial discrepancies between the bursary and students. Third, random bed assignment with no compatibility consideration leads to roommate conflicts that have been empirically linked to reduced academic performance. Fourth, reliance on unverifiable paper payment receipts creates opportunities for forgery and impedes financial auditing. Fifth, the absence of an administrative audit trail means that allocation overrides, portal management decisions, and fee changes are undocumented and unaccountable. Sixth, the lack of cross-domain reporting capability means that administrators cannot generate correlated reports linking student identity, payment, and allocation data, relying instead on ad-hoc spreadsheets that are manually compiled and rapidly become outdated.
3.3 Description of the Proposed System
The proposed system is a web-based, decoupled client-server platform built on React.js 19 with Vite and TailwindCSS 4 for the frontend single-page application, Python FastAPI for the backend REST API and SSE streaming, and PostgreSQL on Supabase as the relational data layer. The system is designed in a legacy institutional aesthetic characterised by high information density, sidebar navigation, tabular data presentation, a conservative colour palette of blues and whites, well-labelled forms, readable tables with alternating row shading, and status badges. Every page is operable by a non-technical hostel officer without training.
The student journey through the system follows a six-step sequential gate flow, with each step enforced on the backend through HTTP 403 responses for students who attempt to access steps they have not qualified for. The six steps are: (1) Register, where the student’s matric number is verified against the session register and account details are auto-populated from the institutional record; (2) Hostel Application Form, where the student selects three ranked hostel preferences and reviews the itemised fee summary; (3) Payment via Paystack, where the exact study-type fee is charged through the Paystack checkout page; (4) Payment Callback, where SSE streaming confirms verification steps in real time and generates the HMS receipt reference; (5) Compatibility Questionnaire, where eight lifestyle questions are answered and encoded into a normalised numeric vector; and (6) AI Allocation, where the weighted cosine similarity algorithm assigns the student to the most compatible available bed.
3.3.1 Advantages of the Proposed System
The proposed system offers seven distinct advantages over the existing manual approach. Instant institutional identity verification eliminates manual cross-checking by validating every registration attempt against the session register in real time. A transparent, itemised fee structure replaces opaque single-figure charging, allowing students and auditors to verify every component of their hostel fee before and after payment. Cryptographic payment verification through the Paystack gateway replaces unverifiable paper receipts with digitally signed transaction records linked to session-scoped HMS receipt references. Compatibility-based fair allocation replaces random bed assignment with a weighted cosine similarity algorithm that optimises roommate groupings based on lifestyle compatibility. Concurrency-safe atomic bed assignment, implemented through PostgreSQL SELECT FOR UPDATE SKIP LOCKED within a stored function, prevents double-booking even when multiple students complete the allocation process simultaneously. An immutable audit trail with twenty-two event types provides comprehensive administrative accountability enforced at the database permission level. A flexible, cross-domain report builder enables administrators to construct custom data extracts by combining filters and columns from across all system data domains.
3.4 System Design
3.4.1 System Architecture
The system employs a three-layer architecture comprising a client layer, a server layer, and a data layer. The client layer is a React.js single-page application deployed on the Vercel platform. React Router version 7 provides client-side routing across all nineteen pages, with protected route components that verify JWT token validity and user role before rendering administrative or student portal pages. Axios is configured with JWT interceptors that automatically attach the authentication token to every API request and handle token expiry by redirecting to the login page. Recharts and Chart.js provide the data visualisation components, including bar charts, line charts, doughnut charts, and the radar chart used for compatibility profile display. The native EventSource API is used to consume SSE streams from the backend during the payment callback and allocation processes.
The server layer is a Python FastAPI application deployed on the Render cloud platform using Gunicorn with Uvicorn ASGI workers for concurrent request handling. The application follows a modular router and service architecture. Routers handle HTTP endpoint definitions and request validation: auth.py for registration and login, student.py for dashboard data and profile updates, application.py for hostel application form submission, payment.py for Paystack transaction initialisation, verification, and webhook handling, quiz.py for questionnaire submission and allocation triggering, allocation.py for allocation details and public lookup, admin.py for session CRUD, hostel infrastructure management, and student management, register_import.py for CSV import processing, report.py for the report builder filter and column engine, and audit.py for audit trail querying and export. Services encapsulate business logic: auth.py for bcrypt hashing and JWT encoding, paystack.py for Paystack API calls, compatibility.py for weighted cosine similarity computation, gemini.py for Gemini API integration, receipt.py for HMS reference generation, audit_logger.py for centralised audit log writing, and report_builder.py for dynamic SQL construction.
The data layer is a PostgreSQL database hosted on the Supabase cloud platform. The database schema comprises fifteen tables following Third Normal Form, with appropriate foreign key constraints and cascading rules. The allocate_bed() stored function encapsulates the entire allocation logic within a single atomic database transaction. The audit_logs table enforces append-only behaviour through database-level permission restrictions, with the application user granted INSERT-only access.
Figure 3.1: System Architecture Diagram [INSERT SCREENSHOT HERE]
3.4.2 Database Design (Data Dictionary)
The database schema comprises fifteen tables and one stored function. The data dictionary for each table is presented below, documenting every field with its data type, constraints, and purpose.
Table 3.1: Users Table (users)
Field Name
Data Type
Constraint
Purpose
id
SERIAL
PRIMARY KEY
Unique user identifier
identifier
VARCHAR(50)
UNIQUE, NOT NULL
Matric number (student) or admin ID
surname
VARCHAR(100)
NOT NULL
Student surname from session register
first_name
VARCHAR(100)
NOT NULL
Student first name from session register
email
VARCHAR(150)
UNIQUE, NOT NULL
Email address for Paystack and communication
phone
VARCHAR(20)
NOT NULL
Phone number in Nigerian format
password_hash
VARCHAR(255)
NOT NULL
Bcrypt-hashed password
gender
VARCHAR(10)
NOT NULL
Male or Female, from session register
department
VARCHAR(100)
NOT NULL
Academic department from session register
level
VARCHAR(10)
NOT NULL
Student level (100L-500L) from register
study_type
VARCHAR(20)
NOT NULL
Full-time, Part-time, or Sandwich
role
VARCHAR(10)
NOT NULL, DEFAULT 'student'
User role: student or admin
next_of_kin_name
VARCHAR(150)
NOT NULL
Emergency contact full name
next_of_kin_phone
VARCHAR(20)
NOT NULL
Emergency contact phone
is_active
BOOLEAN
DEFAULT TRUE
Account active status
created_at
TIMESTAMPTZ
DEFAULT NOW()
Registration timestamp

Table 3.2: Academic Sessions Table (academic_sessions)
Field Name
Data Type
Constraint
Purpose
id
SERIAL
PRIMARY KEY
Unique session identifier
session_name
VARCHAR(20)
UNIQUE, NOT NULL
Session name, e.g. 2025/2026
year_start
DATE
NOT NULL
Academic year start date
year_end
DATE
NOT NULL
Academic year end date
eligible_levels
VARCHAR[]
NOT NULL
Array of eligible levels
is_active
BOOLEAN
DEFAULT FALSE
Active session flag (only one at a time)
application_portal_open
BOOLEAN
DEFAULT FALSE
Controls application access
payment_portal_open
BOOLEAN
DEFAULT FALSE
Controls payment access
allocation_portal_open
BOOLEAN
DEFAULT FALSE
Controls allocation/quiz access
register_import_open
BOOLEAN
DEFAULT FALSE
Controls CSV import access
session_ended
BOOLEAN
DEFAULT FALSE
Permanent archive flag
created_at
TIMESTAMPTZ
DEFAULT NOW()
Session creation timestamp

Table 3.3: Session Register Table (session_register)
Field Name
Data Type
Constraint
Purpose
id
SERIAL
PRIMARY KEY
Auto-increment identifier
session_id
INTEGER
FK → academic_sessions
Session this record belongs to
matric_number
VARCHAR(50)
NOT NULL, UNIQUE per session
Student matric number for verification
surname
VARCHAR(100)
NOT NULL
Student surname from CSV import
first_name
VARCHAR(100)
NOT NULL
Student first name from CSV import
gender
VARCHAR(10)
NOT NULL
Gender: male or female
department
VARCHAR(100)
NOT NULL
Academic department
level
VARCHAR(10)
NOT NULL
Student level (100L-500L)
study_type
VARCHAR(20)
NOT NULL
Full-time, Part-time, or Sandwich
faculty
VARCHAR(100)
NULLABLE
Faculty (optional in CSV)

Table 3.4: Hostels Table (hostels)
Field Name
Data Type
Constraint
Purpose
id
SERIAL
PRIMARY KEY
Unique hostel identifier
name
VARCHAR(100)
UNIQUE, NOT NULL
Hostel name, e.g. Augustus Hall
gender_restriction
VARCHAR(10)
NOT NULL
male, female, or mixed
status
VARCHAR(20)
NOT NULL, DEFAULT 'active'
active, maintenance, or decommissioned
capacity
INTEGER
COMPUTED
Auto-calculated total bed count

Table 3.5: Blocks Table (blocks)
Field Name
Data Type
Constraint
Purpose
id
SERIAL
PRIMARY KEY
Unique block identifier
name
VARCHAR(50)
NOT NULL
Block name, e.g. Block A
hostel_id
INTEGER
FK → hostels
Parent hostel
status
VARCHAR(20)
NOT NULL, DEFAULT 'active'
active or maintenance

Table 3.6: Rooms Table (rooms)
Field Name
Data Type
Constraint
Purpose
id
SERIAL
PRIMARY KEY
Unique room identifier
room_number
VARCHAR(20)
NOT NULL
Room number within block
block_id
INTEGER
FK → blocks
Parent block
status
VARCHAR(20)
NOT NULL, DEFAULT 'active'
active or maintenance

Table 3.7: Beds Table (beds)
Field Name
Data Type
Constraint
Purpose
id
SERIAL
PRIMARY KEY
Unique bed identifier
bed_number
VARCHAR(10)
NOT NULL
Bed number within room
room_id
INTEGER
FK → rooms
Parent room
status
VARCHAR(20)
NOT NULL, DEFAULT 'vacant'
vacant, occupied, or maintenance

Table 3.8: Hostel Applications Table (hostel_applications)
Field Name
Data Type
Constraint
Purpose
id
SERIAL
PRIMARY KEY
Unique application identifier
student_id
INTEGER
FK → users
Applicant student
session_id
INTEGER
FK → academic_sessions
Session applied for
choice_1_id
INTEGER
FK → hostels
First hostel preference
choice_2_id
INTEGER
FK → hostels
Second hostel preference
choice_3_id
INTEGER
FK → hostels
Third hostel preference
special_notes
TEXT
NULLABLE
Disability or welfare notes
status
VARCHAR(20)
DEFAULT 'submitted'
Application status
submitted_at
TIMESTAMPTZ
DEFAULT NOW()
Submission timestamp

Table 3.9: Fee Components Table (fee_components)
Field Name
Data Type
Constraint
Purpose
id
SERIAL
PRIMARY KEY
Unique component identifier
session_id
INTEGER
FK → academic_sessions
Session this fee belongs to
name
VARCHAR(100)
NOT NULL
Component name, e.g. Accommodation
amount_fulltime
INTEGER
NOT NULL
Amount in kobo for full-time students
amount_parttime
INTEGER
NOT NULL
Amount in kobo for part-time students
amount_sandwich
INTEGER
NOT NULL
Amount in kobo for sandwich students
applies_to
VARCHAR(20)
NOT NULL
all, fulltime_only, parttime_only, freshers_only
is_mandatory
BOOLEAN
DEFAULT TRUE
Whether component is mandatory
sort_order
INTEGER
NOT NULL
Display order on receipt and fee panel

Table 3.10: Confirmed Payments Table (confirmed_payments)
Field Name
Data Type
Constraint
Purpose
id
SERIAL
PRIMARY KEY
Unique payment identifier
student_id
INTEGER
FK → users
Paying student
session_id
INTEGER
FK → academic_sessions
Session payment belongs to
hms_reference
VARCHAR(20)
UNIQUE, NOT NULL
HMS/YYYY/XXXXX receipt reference
paystack_id
VARCHAR(100)
UNIQUE
Paystack transaction identifier
total_amount_kobo
INTEGER
NOT NULL
Total amount paid in kobo
payment_channel
VARCHAR(30)
NULLABLE
Card, bank_transfer, ussd, etc.
paystack_status
VARCHAR(20)
NOT NULL
success, abandoned, failed, reversed
status
VARCHAR(20)
NOT NULL
Confirmed, Pending, or Failed
confirmed_at
TIMESTAMPTZ
NOT NULL
Payment confirmation timestamp


Table 3.11: Payment Component Log Table (payment_component_log)
Field Name
Data Type
Constraint
Purpose
id
SERIAL
PRIMARY KEY
Unique record identifier
payment_id
INTEGER
FK → confirmed_payments
Parent payment record
component_id
INTEGER
FK → fee_components
Fee component reference
component_name
VARCHAR(100)
NOT NULL
Component name at time of payment
amount_kobo
INTEGER
NOT NULL
Amount charged for this component

Table 3.12: Student Vectors Table (student_vectors)
Field Name
Data Type
Constraint
Purpose
id
SERIAL
PRIMARY KEY
Unique vector identifier
student_id
INTEGER
FK → users
Student who completed the quiz
session_id
INTEGER
FK → academic_sessions
Session this vector belongs to
v1
DECIMAL(3,2)
NOT NULL
Sleep time preference (0.0–1.0)
v2
DECIMAL(3,2)
NOT NULL
Wake time preference (0.0–1.0)
v3
DECIMAL(3,2)
NOT NULL
Study noise preference (0.0–1.0)
v4
DECIMAL(3,2)
NOT NULL
Cleanliness preference (0.0–1.0)
v5
DECIMAL(3,2)
NOT NULL
Visitor frequency preference (0.0–1.0)
v6
DECIMAL(3,2)
NOT NULL
Night device use preference (0.0–1.0)
v7
DECIMAL(3,2)
NOT NULL
Social preference (0.0–1.0)
v8
DECIMAL(3,2)
NOT NULL
Noise tolerance preference (0.0–1.0)
submitted_at
TIMESTAMPTZ
DEFAULT NOW()
Quiz submission timestamp


A UNIQUE constraint on the combination of student_id and session_id ensures that each student can submit only one lifestyle vector per academic session.
Table 3.13: Allocations Table (allocations)
Field Name
Data Type
Constraint
Purpose
id
SERIAL
PRIMARY KEY
Unique allocation identifier
student_id
INTEGER
FK → users
Allocated student
bed_id
INTEGER
FK → beds
Assigned bed
session_id
INTEGER
FK → academic_sessions
Session of allocation
payment_id
INTEGER
FK → confirmed_payments
Associated payment record
matched_from_preference
INTEGER
NOT NULL
1, 2, or 3 (hostel preference rank used)
avg_compatibility_score
DECIMAL(5,2)
NULLABLE
Average score with roommates (%)
status
VARCHAR(20)
NOT NULL, DEFAULT 'active'
active, revoked, checked_out, expired
revocation_reason
VARCHAR(50)
NULLABLE
Reason for revocation if applicable
revoked_by
VARCHAR(50)
NULLABLE
Admin who revoked
revoked_at
TIMESTAMPTZ
NULLABLE
Revocation timestamp
allocated_at
TIMESTAMPTZ
DEFAULT NOW()
Allocation timestamp



Table 3.14: Compatibility Scores Table (compatibility_scores)
Field Name
Data Type
Constraint
Purpose
id
SERIAL
PRIMARY KEY
Unique score record identifier
student_a_id
INTEGER
FK → users
First student in the pair
student_b_id
INTEGER
FK → users
Second student in the pair
session_id
INTEGER
FK → academic_sessions
Session this score belongs to
score
DECIMAL(5,2)
NOT NULL
Weighted cosine similarity score (0–100)
computed_at
TIMESTAMPTZ
DEFAULT NOW()
Computation timestamp

Table 3.15: Audit Logs Table (audit_logs)
Field Name
Data Type
Constraint
Purpose
id
BIGSERIAL
PRIMARY KEY
Auto-increment, never reused
timestamp
TIMESTAMPTZ
NOT NULL, DEFAULT NOW()
UTC timestamp of the event
actor_type
VARCHAR(20)
NOT NULL
student, admin, system, or paystack
actor_id
VARCHAR(50)
NOT NULL
Matric number, admin username, SYSTEM, or PAYSTACK_WEBHOOK
action_type
VARCHAR(50)
NOT NULL
Standardised action code (22 types)
target_entity
VARCHAR(50)
NOT NULL
Affected entity: allocation, payment, user, session, bed
target_id
VARCHAR(50)
NULLABLE
ID of the affected record
description
TEXT
NOT NULL
Human-readable event description
metadata
JSONB
NULLABLE
Additional context: old/new values, IP, session ID
session_id
INTEGER
FK → academic_sessions
Session context for the event

The audit_logs table has no UPDATE or DELETE permissions granted to the application database user. The application user holds INSERT-only privileges on this table, ensuring that audit records are append-only and structurally immutable at the database permission level.
The allocate_bed() Stored Function: The stored function accepts four parameters: p_student_id (INTEGER), p_preferences (INTEGER ARRAY of three hostel IDs), p_session_id (INTEGER), and p_payment_reference (VARCHAR). It executes within a single database transaction. The function first checks for an existing allocation for the student in the current session, raising an exception if one exists. It then iterates through the student’s three hostel preferences in ranked order. For each preference, it queries all partially-occupied rooms in active blocks with at least one vacant bed matching the student’s gender. For each candidate room, it retrieves the lifestyle vectors of all current occupants and calculates the average weighted cosine similarity with the incoming student’s vector. Candidate rooms are ranked by average compatibility score in descending order. The function selects the highest-scoring room and applies SELECT FOR UPDATE SKIP LOCKED on the target bed to prevent concurrent double-booking. It then updates the bed status to occupied, inserts the allocation record, and inserts pairwise compatibility_scores rows for all roommate combinations. If all three preferences are exhausted with no available beds, the function raises an exception with a descriptive error message.
3.4.3 Input Design
(a) Student Registration Form: The registration process begins with a single matric number input field and a Verify button. Upon clicking Verify, the backend queries the session_register table for the active session. If the matric number is found, the following fields are automatically populated from the session register in read-only format: surname, first name, gender, department, level, and study type. The student cannot modify these values. The student then enters the following fields: email address (valid email format, required for Paystack), phone number (Nigerian format validation), password (minimum 8 characters, bcrypt-hashed before storage), next-of-kin full name, and next-of-kin phone number. If the matric number is not found, registration is blocked with the message: "Your matric number was not found in the 2025/2026 session register. Please contact the Student Affairs Unit." If an account already exists for the matric number, the message displayed is: "An account already exists for this matric number. Please log in instead."
(b) Hostel Application Form: The application form presents three ranked hostel preference dropdown selectors, each filtered to show only hostels matching the student’s gender or mixed-gender hostels. Each dropdown option displays the hostel name and current occupancy percentage in brackets, for example: "Augustus Hall (78% full)". The second dropdown excludes the hostel selected in the first, and the third excludes hostels selected in the first and second. An optional special consideration textarea allows students to note disability, medical condition, or welfare concerns for administrative awareness; this field does not affect the allocation algorithm. Below the form fields, a read-only fee summary panel displays every fee component applicable to the student’s study type and level, with individual amounts and the calculated total, before the student clicks Proceed to Payment.
(c) Compatibility Questionnaire: The questionnaire presents eight lifestyle questions, each displayed as a card with icon-labelled options. The student selects one option per question. The eight questions and their response options with associated numeric values are presented in Table 3.16.

Table 3.16: Compatibility Questionnaire Questions and Response Values
#
Dimension
Question
Options (Value)
1
Sleep time
What time do you usually go to sleep?
Before 10 PM (1.0) / 10 PM–Midnight (0.67) / After Midnight (0.33) / Very late, after 2 AM (0.0)
2
Wake time
What time do you usually wake up?
Before 6 AM (1.0) / 6–8 AM (0.67) / 8–10 AM (0.33) / After 10 AM (0.0)
3
Study noise
What environment do you study in?
Complete silence required (0.0) / Low background noise is fine (0.33) / Music or noise is fine (0.67) / I study anywhere (1.0)
4
Cleanliness
How do you keep your living space?
Very tidy (1.0) / Reasonably tidy (0.67) / I clean when I have time (0.33) / Relaxed about mess (0.0)
5
Visitors
How often do you have guests in your room?
Never (0.0) / Occasionally, with notice (0.33) / Regularly (0.67) / My room is always open (1.0)
6
Night device use
Do you use phone/laptop with lights on at night?
Never (1.0) / Sometimes (0.67) / Often (0.33) / Yes, regularly (0.0)
7
Social preference
How do you prefer your room atmosphere?
Quiet and private (0.0) / Calm with some interaction (0.33) / Fairly social (0.67) / Very social and lively (1.0)
8
Noise tolerance
How sensitive are you to noise?
Very sensitive (0.0) / Somewhat sensitive (0.33) / Moderately tolerant (0.67) / I can sleep through anything (1.0)


(d) Admin Session Creation Form: The session creation form includes the session name (e.g. 2025/2026), academic year start and end month/year pickers, a multi-select field for eligible levels, and the fee component builder. The fee component builder allows the administrator to define named fee components with separate amounts for full-time, part-time, and sandwich students, an applicability scope selector (all, fulltime_only, parttime_only, freshers_only), and a sort order for display sequencing on the receipt and fee panel.
(e) Admin Report Builder: The report builder input interface comprises a report name text field, an optional description textarea, a filters section presenting the complete filter catalogue organised into six categories (session and time filters, student identity filters, status flag filters, financial filters, accommodation filters, and AI compatibility filters), and a column selector presenting the complete column catalogue. Each filter includes an operator dropdown supporting operators such as is, is not, contains, is before, is after, is between, is empty, and is not empty. Multiple selected filters combine with AND logic.
3.4.4 Output Design
(a) Student Dashboard Output: The student dashboard displays a horizontal four-step progress stepper indicating the student’s current position in the hostel process (Pay Hostel Fee, Complete Questionnaire, Allocated, Checked In), with colour-coded states: locked (grey), in progress (blue, pulsing), complete (green tick), and error (red). Below the stepper, four metric cards display: Study Type, Hostel Fee Due (replaced by receipt reference after payment), Payment Status, and Allocation Status. Two charts are displayed: a horizontal bar chart showing current hostel occupancy percentages for all available hostels, and a compatibility radar chart (visible only after allocation) with eight axes representing the lifestyle dimensions, showing the student’s own profile overlaid with the room average of assigned roommates.
(b) Student Allocation Page Output: The allocation page displays a prominent bed details card (hostel name, block name, room number, bed number), an AI match summary sentence generated by the Gemini API, roommate cards showing each roommate’s name, matric number, and individual compatibility score as a percentage, and the compatibility radar chart with the student’s profile versus the room average.
(c) HMS Payment Receipt Output: The receipt displays the HMS receipt reference (e.g. HMS/2026/00432), Paystack transaction ID, institution name, session, student name, matric number, study type, level, department, fee breakdown listing each component with its amount, total amount paid, payment date and time, payment method, hostel preferences submitted, and a system stamp confirming automatic generation.
(d) Admin Dashboard Output: The admin dashboard displays six metric cards (total registered students, total bed spaces, current occupancy percentage, total revenue for the session, unallocated eligible students, active allocations), three charts (occupancy per hostel horizontal bar chart with colour coding, allocations per day line chart, gender distribution doughnut chart), a recent activity feed showing the last ten audit log entries, and the natural language query input box.
(e) Report Builder Output: The report builder output displays a live preview table showing the first fifty rows with a total row count indicator. An aggregate footer row displays SUM for financial columns, AVERAGE for compatibility scores, and COUNT for all rows, all respecting active filters. The CSV export includes a metadata header section with report name, description, generating admin, generation timestamp, and applied filters, followed by the complete data set.
(f) Audit Trail Output: The audit trail presents a filterable table with columns for timestamp, actor type (displayed as a badge), actor ID, action description, and affected entity. Filters include date range, actor type, action type, and target entity. Full-text search is available on the description field. Each row expands to show the full metadata JSON. CSV export includes all metadata columns.


3.4.5 System Flowchart and Algorithm Logic
Flowchart 1 — Complete Student Journey: The student journey flowchart traces the complete path from initial access to final allocation. The process begins with the student entering their matric number on the registration page. The system queries the session register for the active session. If the matric number is not found, registration is denied. If found, the student’s institutional details are auto-populated and the student completes the remaining registration fields. Upon successful registration, the student logs in and accesses the dashboard. If the application portal is open, the student fills the hostel application form with three ranked preferences. If the payment portal is open, the student proceeds to the payment page where the itemised fee is displayed. The student initiates Paystack checkout and is redirected to the Paystack-hosted page. Upon return, the payment callback SSE stream verifies the transaction, confirms the amount match, generates the HMS receipt reference, and records the payment. If the allocation portal is open, the compatibility questionnaire is unlocked. The student answers eight lifestyle questions, the responses are encoded as a normalised vector, and the allocate_bed() stored function is invoked. The function iterates through the three preferences, computes weighted cosine similarity for each candidate room, selects the highest-scoring bed with row-level locking, and inserts the allocation record. The student is redirected to the allocation page where they can view their assigned bed, roommate compatibility scores, and the radar chart.
Figure 3.2: Complete Student Journey Flowchart [INSERT SCREENSHOT HERE]
Flowchart 2 — allocate_bed() Stored Function Logic: The stored function begins by checking whether the student already has an allocation for the current session. If an existing allocation is found, an exception is raised. The function then enters a loop iterating through the student’s three hostel preferences in order (preference 1, then 2, then 3). For each preference, the function queries all rooms in active blocks that have at least one vacant bed and match the student’s gender. For each candidate room, the function retrieves the lifestyle vectors of all current occupants from the student_vectors table and computes the average weighted cosine similarity between the incoming student’s vector and the occupants’ vectors. The candidate rooms are ranked by average compatibility score in descending order. The function selects the highest-scoring room and acquires a row-level lock on the target bed using SELECT FOR UPDATE SKIP LOCKED. If the lock is acquired successfully, the function updates the bed status to occupied, inserts a record into the allocations table, inserts pairwise compatibility_scores rows for all roommate combinations, and returns the allocation result. If the lock cannot be acquired (indicating concurrent access), the function moves to the next candidate room. If all rooms in a hostel preference are exhausted, the function moves to the next preference. If all three preferences are exhausted without a successful allocation, the function raises an exception with the message: "No beds available in your selected hostels. Please contact Student Affairs."
Figure 3.3: allocate_bed() Stored Function Flowchart [INSERT SCREENSHOT HERE]
Weighted Cosine Similarity Algorithm Specification: The compatibility matching algorithm employs weighted cosine similarity to compare two eight-dimensional student lifestyle vectors. Given two vectors A = (A1, A2, ..., A8) and B = (B1, B2, ..., B8) and a weight vector W = (w1, w2, ..., w8), the weighted cosine similarity is computed as:
similarity(A, B) = (Σ wi × Ai × Bi) / (sqrt(Σ wi × Ai²) × sqrt(Σ wi × Bi²))
where i ranges from 1 to 8 and wi is the weight assigned to dimension i. The result is a value between 0.0 (completely opposite lifestyles) and 1.0 (perfect match). The dimension weights used in this system are presented in Table 3.17.
Table 3.17: Dimension Weights for Weighted Cosine Similarity
Dimension
Weight
Justification
Sleep time (v1)
0.20
Highest conflict source in shared accommodation
Noise tolerance (v8)
0.18
Second most complained-about issue
Study noise preference (v3)
0.15
Direct impact on academic performance
Cleanliness (v4)
0.15
Primary reason for room transfer requests
Wake time (v2)
0.12
Correlated with sleep time, independently weighted
Night device use (v6)
0.08
Light and screen use disturbs light sleepers
Visitors (v5)
0.07
Privacy concern, more negotiable
Social preference (v7)
0.05
Most adaptable dimension

These weights were derived from the hostel conflict literature, with particular reference to the systematic review by Adeniyi et al. (2024) which identified sleep schedule mismatches, noise sensitivity differences, and cleanliness standard disparities as the three highest-impact sources of roommate conflict in Nigerian university hostels.

CHAPTER FOUR: SYSTEM IMPLEMENTATION AND EVALUATION
4.1 Introduction
This chapter documents the implementation of the AI-Driven Hostel Management System, including the hardware and software requirements, the academic justification for the choice of programming languages and technologies, the detailed implementation of each core module with reference to specific source code files, and the comprehensive functional testing conducted to evaluate the system against both normal operation scenarios and edge cases.
4.2 System Requirements
4.2.1 Hardware Requirements
Table 4.1: Server-Side Hardware Requirements
Component
Minimum Specification
Recommended Specification
Processor
2 vCPU cores
4 vCPU cores
RAM
2 GB
4 GB
Storage
10 GB SSD
20 GB SSD
Network
100 Mbps bandwidth
1 Gbps bandwidth
Operating System
Ubuntu 20.04 LTS or compatible
Ubuntu 22.04 LTS

Table 4.2: Client-Side Hardware Requirements
Component
Minimum Specification
Recommended Specification
Processor
Dual-core 1.5 GHz
Quad-core 2.0 GHz or higher
RAM
2 GB
4 GB or higher
Display
1024 x 768 resolution
1280 x 720 or higher
Network
Stable internet connection
Broadband connection
Browser
Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
Latest version of any major browser

4.2.2 Software Requirements
Table 4.3: Software Requirements
Software
Version
Purpose
Node.js
18+
Frontend build environment (Vite)
Python
3.10+
Backend runtime
PostgreSQL
14+
Relational database
Git
Latest
Version control
npm/yarn
Latest
Frontend package management
pip
Latest
Python package management
Gunicorn
Latest
ASGI server for production deployment
Uvicorn
Latest
ASGI worker for FastAPI

4.3 Choice of Programming Languages
Python with FastAPI: Python was selected as the backend programming language for three primary reasons. First, Python’s dominance in the artificial intelligence and machine learning ecosystem ensures native access to NumPy for vector computation and the google-generativeai SDK for Gemini API integration, both of which are core to the system’s AI features. Second, the FastAPI framework provides native asynchronous ASGI support, enabling SSE streaming for the real-time payment callback flow and concurrent request handling through Gunicorn with Uvicorn workers. Third, FastAPI’s Pydantic-based automatic request validation eliminates the need for manual input validation code, reducing development time and minimising validation-related bugs.
JavaScript with React.js: JavaScript was selected as the frontend programming language through the React.js library for three primary reasons. First, React’s component-based architecture is well-suited to a nineteen-page single-page application with complex state management requirements, including the multi-step gated student journey, conditional rendering based on allocation status, and real-time SSE stream consumption. Second, the Recharts and Chart.js libraries provide the data visualisation components required for the dashboard charts and the compatibility radar chart. Third, the native EventSource API available in all modern browsers provides built-in SSE support for the payment callback streaming flow.
SQL with PostgreSQL: PostgreSQL was selected as the database management system for four primary reasons. First, stored function support enables the encapsulation of the allocation algorithm in a single atomic transaction, ensuring that the compatibility computation, bed locking, allocation insertion, and compatibility score recording either all succeed or all fail. Second, the SELECT FOR UPDATE SKIP LOCKED mechanism provides the concurrency control required to prevent double-booking without introducing deadlocks. Third, the JSONB data type enables flexible metadata storage in the audit_logs table without requiring schema changes for new event types. Fourth, the database-level permission model enables the append-only guarantee on the audit_logs table by restricting the application user to INSERT-only access.


4.4 Implementation Details
4.4.1 Authentication Module
The authentication module, implemented in routers/auth.py and services/auth.py, handles user registration, login, and JWT-based session management. During registration, the matric number submitted by the student is queried against the session_register table for the currently active session. If a matching record is found, the student’s surname, first name, gender, department, level, and study type are extracted from the register and stored directly in the users table. The password provided by the student is hashed using the bcrypt algorithm via the passlib library before storage. Upon successful registration, a JWT token is issued containing the user’s ID, role (student or admin), and an expiration timestamp. Login follows a similar pattern: the submitted credentials are verified against the stored password hash, and upon success, a new JWT token is issued. The JWT dependency injection function, implemented in dependencies.py, is attached to all protected route handlers and validates the token’s signature, expiry, and role before allowing access to the endpoint.
4.4.2 Session Register Import Module
The session register import module, implemented in routers/register_import.py, processes the CSV file uploaded by the administrator. The import flow begins with column validation, confirming that the required headers (matric_number, surname, first_name, gender, department, level, study_type) are present in the uploaded file. The system then validates each row, checking that no matric numbers are blank, gender values are restricted to "male" or "female", level values conform to the institution type configuration (100L through 500L for University mode), and study type values are restricted to "Full-time", "Part-time", or "Sandwich". A preview of the first ten rows, the total row count, and any validation errors are returned to the administrator for review. Upon confirmation, all rows are inserted into the session_register table with the appropriate session_id foreign key. If a register already exists for the target session, the administrator receives a warning and must confirm replacement. The import event is logged in the audit trail with the admin ID, session identifier, row count, and timestamp.
4.4.3 Multi-Component Fee and Payment Module
The fee and payment module spans routers/payment.py, services/paystack.py, and services/receipt.py. When a student navigates to the payment page, the backend queries all fee_components for the active session, filters by the applies_to field to include only components applicable to the student’s study type and level (with freshers_only components included only for 100-Level students), and sums the applicable amounts to calculate the exact total. The total is displayed as an itemised breakdown to the student before payment initiation. When the student clicks the payment button, the backend creates a pending payment record, calls the Paystack Transactions Initialise API with the amount in kobo, and returns the authorisation URL. The frontend redirects the student to the Paystack-hosted checkout page. Upon return, the payment callback endpoint receives the transaction reference, calls the Paystack Transactions Verify API, confirms that the transaction status is "success" and the amount matches the expected fee, generates the HMS receipt reference using the HMS/YYYY/XXXXX format, inserts a confirmed_payments record, inserts individual rows in the payment_component_log table for each fee component, and logs the event in the audit trail. The SSE stream delivers each verification step to the student’s browser in real time. The webhook endpoint (POST /api/v1/payment/webhook) provides a fallback verification path.
4.4.4 Compatibility Matching Module
The compatibility matching module, implemented in routers/quiz.py and services/compatibility.py, processes the student’s questionnaire responses and triggers the allocation algorithm. When the student submits the eight-question compatibility questionnaire, each response is mapped to its corresponding normalised decimal value (0.0 to 1.0) as defined in the questionnaire specification. The eight values are stored as columns v1 through v8 in the student_vectors table with the student_id and session_id. The compatibility.py service implements the weighted cosine similarity computation using NumPy array operations. The function accepts two vectors and the weight array, computes the weighted dot product and weighted magnitudes, and returns the similarity score. This function is called by the allocate_bed() stored function through the allocation trigger in quiz.py, which passes the student’s three hostel preferences, session ID, and payment reference to the stored function. Upon successful allocation, pairwise compatibility scores between the newly allocated student and each existing roommate in the assigned room are computed and stored in the compatibility_scores table.
4.4.5 Atomic Bed Allocation
The allocate_bed() stored function, defined in schema_exec.sql, is the core of the allocation engine. It executes within a single PostgreSQL transaction. The function first queries the allocations table to check for an existing active allocation for the student in the current session, raising an exception if one exists. It then enters a loop over the student’s three hostel preference IDs. For each preference, the function joins the hostels, blocks, rooms, and beds tables to find all rooms in active blocks with at least one vacant bed. For each candidate room, the function retrieves the lifestyle vectors of all current occupants from the student_vectors table and computes the average weighted cosine similarity with the incoming student’s vector. Rooms are ranked by this average score in descending order. The function attempts to acquire a row-level lock on the highest-scoring room’s target bed using SELECT FOR UPDATE SKIP LOCKED. If the lock is acquired, the bed status is updated to occupied, an allocation record is inserted with the matched_from_preference field set to the current preference rank, and pairwise compatibility score records are inserted. If the lock cannot be acquired, the function moves to the next candidate room. If all candidate rooms for a preference are exhausted, the function moves to the next preference. If all three preferences are exhausted, the function raises an exception with a descriptive error message.
4.4.6 Admin Natural Language Query
The natural language query feature, implemented in services/gemini.py, enables administrators to query system data using plain English from the admin dashboard. When an administrator submits a query through the input box, the backend constructs a prompt for the Google Gemini API that includes the complete database schema as context and instructs the model to generate a read-only SELECT SQL query. The generated SQL is validated by the backend to confirm it is a SELECT statement and does not contain INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or any other mutation keyword. If the validation passes, the query is executed against the database and the results are returned in a tabular format for display in the admin dashboard. If the validation fails, the query is rejected with an error message indicating that only read-only queries are permitted. The query text, generated SQL, and result count are logged in the audit trail with the ADMIN_NL_QUERY action type.
4.4.7 Audit Trail
The audit trail module, implemented in services/audit_logger.py, provides a centralised logging function that writes event records to the audit_logs table. The logging function is called as a fire-and-forget background task using FastAPI’s BackgroundTasks mechanism, ensuring that a logging failure never blocks the main operation. Each audit record captures the actor type (student, admin, system, or paystack), actor ID, action type code, target entity, target ID, human-readable description, JSONB metadata, and session ID. Twenty-two distinct action type codes are defined, covering user registration, login, profile updates, application submission, payment initiation, payment confirmation, payment failure, receipt generation, quiz submission, allocation creation, allocation revocation, session creation, session activation, portal toggling, fee component addition and update, register import, hostel creation, hostel status change, report generation, and admin natural language query. The database-level permission model restricts the application user to INSERT-only access on the audit_logs table, preventing any programmatic modification or deletion of audit records.
4.4.8 Report Builder
The report builder module, implemented in routers/report.py and services/report_builder.py, constructs dynamic SQL queries from administrator-selected filters and columns. The report_builder.py service maintains strict whitelists of allowed filter fields and column names, defined as constants rather than user-supplied strings, to prevent SQL injection. The filter catalogue spans six categories: session and time filters, student identity filters, status flag filters, financial filters, accommodation filters, and AI compatibility filters. The column catalogue spans five categories: student identity columns, payment columns, allocation columns, AI and compatibility columns, and session columns. When the administrator selects filters and columns, the service constructs the appropriate SQL query with JOIN clauses connecting the relevant tables, applies the selected filters with AND logic, and executes the query. The live preview returns the first fifty rows along with an aggregate footer showing SUM for financial columns, AVERAGE for compatibility scores, and COUNT for all rows. The CSV export includes a metadata header section followed by the complete dataset and the aggregate footer.

4.5 System Testing
Comprehensive functional testing was conducted to evaluate the system against both normal operation scenarios and edge case conditions. The test cases are presented in two formal tables: Table 4.4 for normal operation tests and Table 4.5 for edge case and error handling tests.
Table 4.4: Normal Operation Test Cases
Test Case ID
Input / Action
Expected Result
Actual Result
TC-01
Register with valid matric number in session register
Account created; institutional details auto-populated; JWT issued
Pass
TC-02
Register with matric number not in session register
Registration blocked; error message displayed
Pass
TC-03
Login with valid credentials
JWT returned; redirect to appropriate dashboard
Pass
TC-04
Submit hostel application with 3 ranked preferences
Application stored; fee breakdown displayed; payment unlocked
Pass
TC-05
Initiate Paystack payment for correct amount
Redirect to Paystack checkout; pending payment created
Pass
TC-06
Complete successful Paystack payment
SSE stream confirms each step; HMS receipt reference generated; quiz unlocked
Pass
TC-07
Submit 8-question compatibility questionnaire
Lifestyle vector stored; allocation algorithm triggered; bed assigned
Pass
TC-08
View allocation from first hostel preference
Bed details displayed; roommate scores shown; radar chart rendered
Pass
TC-09
View allocation from second preference (first full)
Allocation from second choice; correct preference rank displayed
Pass
TC-10
Admin creates new academic session
Session record created; all portal toggles initialised to OFF
Pass
TC-11
Admin toggles application portal to OPEN
Portal status updated; toggle change logged in audit trail
Pass
TC-12
Admin imports student register CSV
CSV validated; preview shown; records inserted in session_register
Pass
TC-13
Admin generates custom report with filters
Filtered data displayed in live preview; CSV export completed
Pass
TC-14
Public allocation lookup with allocated matric
Hostel, block, and room displayed; no personal data exposed
Pass

Table 4.5: Edge Case and Error Handling Test Cases
Test Case ID
Input / Action
Expected Result
Actual Result
TC-15
Two students target same last bed simultaneously
One succeeds; other gets next compatible bed; no double-booking
Pass
TC-16
Student attempts payment when portal is closed
HTTP 403 returned; clear message about closed portal
Pass
TC-17
Paystack amount does not match study type fee
Payment rejected; amount mismatch error displayed
Pass
TC-18
CSV import with missing required columns
Validation error; import blocked; missing columns listed
Pass
TC-19
CSV import with invalid gender values
Validation error; invalid rows identified in preview
Pass
TC-20
All three hostel preferences fully occupied
Exception raised; descriptive error message displayed
Pass
TC-21
Admin NL query attempts INSERT/UPDATE/DELETE
Query rejected; mutation keywords detected; read-only error shown
Pass
TC-22
Quiz submission attempted before payment
HTTP 403 returned; stepper shows payment step required
Pass
TC-23
Allocation page accessed before quiz submission
HTTP 403 returned; stepper shows quiz step required
Pass
TC-24
Registration attempt with already-registered matric
Registration blocked; login redirect message shown
Pass
TC-25
Paystack webhook with invalid signature
Webhook rejected; event not processed; error logged
Pass


CHAPTER FIVE: SUMMARY, CONCLUSION, AND RECOMMENDATIONS
5.1 Summary
This project addressed the chronic inadequacies of manual hostel management in Nigerian federal universities by designing and implementing an AI-Driven Hostel Management System that integrates institutional identity verification, secure multi-component fee payment, compatibility-based roommate matching, and administrative accountability mechanisms within a single unified web platform. The project was motivated by four documented failure modes of the existing manual system: the absence of real-time identity verification, opaque single-figure fee structures, random bed assignment with no compatibility consideration, and the lack of an administrative audit trail.
The system was developed using React.js 19 with Vite and TailwindCSS 4 for the frontend single-page application, Python FastAPI for the backend REST API and SSE streaming, PostgreSQL on Supabase as the relational data layer, the Paystack API for payment processing, NumPy for vector computation, and the Google Gemini API for natural language query processing. The platform comprises nineteen screens across three access layers: three public pages, eight student portal pages, and eight administrative portal pages.
The student journey follows a six-step sequential gate flow enforced on the backend, beginning with session-register-verified registration and concluding with compatibility-weighted bed allocation. The allocation algorithm employs weighted cosine similarity on eight-dimensional student lifestyle vectors, with dimension weights derived from hostel conflict literature. Concurrency safety is guaranteed through PostgreSQL SELECT FOR UPDATE SKIP LOCKED within an atomic stored function. The payment module integrates the Paystack gateway for multi-component fee collection, with each payment generating a session-scoped HMS receipt reference and an itemised component log. The audit trail records twenty-two categories of system events in an append-only table with database-level immutability. The report builder enables administrators to construct custom data extracts across all system data domains using a comprehensive filter and column catalogue.
Functional testing confirmed that all eight project objectives were successfully met. Normal operation tests verified the complete student journey, administrative session management, register import, and report generation. Edge case tests confirmed the robustness of the concurrent allocation mechanism, closed portal enforcement, fee amount validation, CSV import validation, mutation query rejection in the natural language module, and Paystack webhook signature verification.
5.2 Conclusion
The AI-Driven Hostel Management System developed in this project fulfils all eight objectives stated in Section 1.3 of this report. Institutional identity verification was implemented through the session register import and matric number validation mechanism, preventing unauthorised access to the platform. The multi-component fee builder provides transparent, auditable fee structures aligned with the actual composition of Nigerian university hostel charges. The Paystack payment gateway integration, with automatic HMS receipt reference generation, replaces unverifiable paper receipts with cryptographically verified digital records. The weighted cosine similarity roommate matching algorithm, operating on eight-dimensional lifestyle vectors with empirically justified dimension weights, replaces random bed assignment with a fair, compatibility-optimised, and concurrency-safe allocation process. The natural language query feature extends administrative capability by enabling plain English data interrogation with automatic SQL generation and mutation prevention. The immutable audit trail, enforced at the database permission level, provides a comprehensive accountability record equivalent to the physical registers maintained in legacy hostel offices. The structured report builder delivers cross-domain data correlation and export capability that manual spreadsheet processes cannot replicate.
The integration of these capabilities within a single unified platform, purpose-built for the Nigerian university context and designed in a legacy institutional aesthetic that prioritises function over decoration, constitutes a viable, scalable, and transparency-first framework for modernising hostel management in Nigerian federal universities. The system is institution-configurable, supporting University, Polytechnic, and College of Education modes, and is designed for adoption beyond the Federal University Oye-Ekiti.
5.3 Recommendations
Live Remita API Integration: Future work should replace the mock Remita verification table with a live call to the Remita Collections API for real-time school fees confirmation. This would eliminate the need for the administrator to manage fee eligibility through the CSV import process and would provide a direct, automated link between school fees payment and hostel fee eligibility.
Biometric Check-In: The integration of fingerprint or facial recognition at the physical hostel check-in point would provide a layer of occupancy verification that bridges the gap between digital allocation and physical presence. This would prevent squatting and confirm that the student who was digitally allocated a bed is the same individual who physically occupies it.
Mobile Application: The development of a native Android and iOS application would complement the responsive web portal by enabling push notifications for allocation updates, offline receipt storage, and a more streamlined mobile payment experience. Given the high mobile device penetration among Nigerian university students, a dedicated mobile application would improve accessibility and user engagement.
Multi-Tenant Deployment: The institution type configuration mechanism implemented in this system provides the foundation for a full multi-tenant architecture in which multiple universities could operate on shared infrastructure with isolated data environments. This would reduce deployment costs and enable a centralised update and maintenance model.
Compatibility Algorithm Refinement: Post-occupancy satisfaction data should be collected from students over multiple academic sessions to empirically calibrate the dimension weights used in the cosine similarity model. Replacing the literature-based initial weights with institution-specific weights derived from actual roommate satisfaction outcomes would progressively improve matching quality.
WCAG Accessibility Audit: A formal Web Content Accessibility Guidelines (WCAG 2.1) audit should be conducted to ensure the platform is fully usable by students with visual, auditory, or motor impairments. This is both an ethical imperative and an increasingly common requirement for institutional information systems.

REFERENCES
Adebayo, T., & Smith, R. (2022). Transparency challenges in student hostel management: A Nigerian perspective. Journal of Educational Administration, 38(2), 112–128.
Adeniyi, O. J., et al. (2024). Exploring the link between roommate compatibility and academic outcomes: A systematic review. African Journal of Computer Science and Technology, 13(2), 30–45.
Adeyemi, P., & Smith, D. (2023). Evaluating usability and form abandonment in Nigerian academic portals. Journal of Human-Computer Interaction, 15(4), 201–218.
Chen, H., & Mensah, K. (2022). Role-based access control and privilege escalation prevention in multi-tier administrative portals. IEEE Transactions on Software Engineering, 48(9), 3421–3436.
Gale, D., & Shapley, L. S. (1962). College admissions and the stability of marriage. The American Mathematical Monthly, 69(1), 9–15.
Gupta, S., & Okafor, E. (2024). Comparative analysis of NoSQL and RDBMS for ACID-compliant institutional resource planning systems. International Journal of Database Management, 22(1), 55–72.
Nair, R., & Patel, A. (2022). Weighted decision logic and stable matching algorithms for equitable public resource distribution. Journal of Computational Social Science, 5(3), 445–462.
Olatunji, S. O., Adebisi, T. R., & Oluwole, M. A. (2021). Impact of hostel accommodation on academic performance of students in Nigerian universities. Journal of Education and Practice, 12(15), 78–89.
Oyekanmi, A. O. (2023). Leveraging artificial intelligence for administrative automation in Nigerian tertiary institutions. African Journal of Computing and ICT, 16(2), 34–48.
Rahman, S., & Manoj Kumar, D. S. (2021). Optimal room and roommate matching system using nearest neighbours algorithm with cosine similarity distribution. Social Science Research Network. https://doi.org/10.2139/ssrn.3869826
Sharma, R., Khanchandani, S., & Morris, R. (2024). Enhancing mobile roommate matching with artificial intelligence algorithm: A progressive framework. In Lecture Notes in Networks and Systems (Vol. 1107). Springer, Singapore. https://doi.org/10.1007/978-981-97-6581-2_20
Zhang, L., et al. (2024). Personalised dormitory roommate matching system based on multiple swarm genetic algorithms. Advances in Computer, Signals and Systems, 8(3), 65–78.

