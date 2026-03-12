CHAPTER THREE
SYSTEM ANALYSIS AND DESIGN

3.1 ANALYSIS OF THE EXISTING SYSTEM
The existing system for managing hostel accommodation in many Nigerian tertiary institutions is predominantly manual. When a new academic session begins, students who require hostel accommodation are expected to visit the Student Affairs Unit physically. Upon arrival, they collect paper-based application forms, complete them by hand, and submit them to the relevant administrative staff. The process typically requires students to join long queues, often spending several hours waiting for their turn to be attended to by overburdened clerical officers.
Once a form is submitted, payment for hostel fees is made through bank deposits or over-the-counter transactions. Students are then required to return to the Student Affairs Unit with proof of payment, usually in the form of a bank teller or receipt, for manual verification by administrative staff. This verification process is time-consuming and highly susceptible to errors. Receipts may be misplaced, forged, or illegible, making it difficult for staff to confirm legitimate payments. Furthermore, the manual nature of the verification process creates significant bottlenecks, especially during peak registration periods.
Room allocation under the existing system is conducted manually, with staff assigning bed spaces by consulting physical registers or logbooks. This approach lacks a real-time tracking mechanism for room occupancy, which frequently results in the double allocation of a single bed space to multiple students. Such errors lead to disputes, confusion, and considerable frustration among the student population. Additionally, there is no transparent mechanism for students to view the availability of rooms before making payment, forcing them to rely entirely on information provided by staff, which may not always be current or accurate.
The absence of a centralized digital record also means that historical accommodation data is difficult to retrieve. Physical files are prone to damage from environmental factors such as water, fire, and pest infestation, and they can be easily misplaced or lost. The overall lack of transparency, efficiency, and accountability in the manual system highlights the critical need for a modern, technology-driven solution.
3.2 DESCRIPTION/ANALYSIS OF THE NEW SYSTEM
The proposed system is a web-based Hostel Management System developed to replace the manual processes described above with an automated, transparent, and efficient digital platform. The system is built using React.js for the frontend user interface, TypeScript for enforcing type-safe application logic, and Firebase as the Backend-as-a-Service (BaaS) for real-time database management, user authentication, and cloud hosting.
React.js provides a component-based architecture that enables the creation of a dynamic, responsive, and interactive user interface. TypeScript, a superset of JavaScript, adds static typing to the development process, which significantly reduces runtime errors and improves the maintainability of the codebase. Firebase provides a suite of cloud-based tools, including Firestore for the NoSQL database, Firebase Authentication for secure user login, and Firebase Storage for managing static assets. This technology stack eliminates the need for a traditional server setup, reducing development complexity and deployment time.
The new system assists the Student Affairs Unit by automating the core functions of hostel management. Administrators can manage hostel blocks, define room capacities, set prices, and approve or reject booking requests through a secure administrative dashboard. Students can register, browse available rooms, make payments, and receive instant booking confirmations from any internet-enabled device. The system maintains a real-time record of all room allocations and transactions, thereby eliminating the errors and inefficiencies associated with manual processes.

3.3 SYSTEM DESIGN
The system is designed to promote transparency and efficiency in the hostel allocation process. A key design principle is real-time data synchronization, enabled by Firebase Firestore. When a room is booked or its status changes, the update is reflected immediately across all connected client devices. This ensures that students always have access to the most current information regarding room availability, thereby preventing the double allocation problem that plagues the manual system.
The platform allows students to register and create personal accounts using their institutional email addresses. Upon successful authentication, students gain access to a personalized dashboard from which they can browse hostel blocks, view room details such as capacity and price, and initiate a booking. The entire process, from registration to room booking confirmation, can be completed remotely from a smartphone, tablet, or laptop computer without the need to visit any physical office.
The administrative module is designed to give authorized personnel full control over the platform. Administrators can add new hostel blocks and rooms, update pricing, manage student records, and generate occupancy reports. Role-based access control ensures that different levels of administrative users, such as the Chief Porter and Hall Wardens, have access only to the functions relevant to their responsibilities.
3.3.1 OUTPUT DESIGN
The output design of the system refers to the information that the platform presents to its users. For students, the primary output is a dynamic, filterable list of available hostel rooms displayed on the dashboard. Each entry in the list shows the room number, the block or hall it belongs to, the room type (indicating the number of occupants), the current occupancy status (Available or Full), and the price per bed space. This list updates in real-time as bookings are made.
Upon successful payment and booking confirmation, the system generates a digital receipt that contains the student’s name, matriculation number, the allocated room details, the amount paid, the transaction reference, and the date of booking. This receipt can be downloaded as a PDF or printed directly from the platform, serving as an official proof of accommodation.
For administrators, the output includes comprehensive occupancy dashboards, financial transaction logs, and downloadable reports on hostel utilization for each academic session. The table below illustrates a sample output of the hostel room list as displayed on the student interface.
YABATECH HOSTEL MANAGEMENT SYSTEM
HOSTEL ROOM LIST
#
Room Number
Block/Hall
Type
Status
Price
1
XXXXX
XXXXX
XXXXX
XXXXX
XXXXX
2
RM-102
 Block A
XXXXX
XXXXX
 25,000
3
RM-201
 Block B
XXXXX
 Available
 18,000
4
RM-305
 Block C
XXXXX
 Available
 40,000
5
RM-410
 Block D
XXXXX
 Full
 25,000






#
MATRIC NO.
STUDENT NAME
HOSTEL/BLOCK
ROOM NO.
BED SPACE
STATUS
1
XXXXX
XXXXX
XXXXX
XXXXX
XXXXX
XXXXX
2
XXXXX
XXXXX
XXXXX
XXXXX
XXXXX
XXXXX
3
XXXXX
XXXXX
XXXXX
XXXXX
XXXXX
XXXXX
4
XXXXX
XXXXX
XXXXX
XXXXX
XXXXX
XXXXX
5
XXXXX
XXXXX
XXXXX
XXXXX
XXXXX
XXXXX


Table 3.2: Sample Output – Student Allocation Details
3.2.3 INPUT DESIGN
The input design of the Hostel Management System specifies the forms and data entry interfaces through which users supply information to the platform. The system employs a series of structured web-based forms built with React.js components and validated using TypeScript type definitions to ensure that only correctly formatted data is submitted to the backend database. Input validation is performed on both the client side (using form validation rules) and the server side (using middleware checks) before any data is persisted.
The primary input interfaces of the system are described below:

(a) Student Registration Form
This form is the first point of interaction for any student wishing to use the platform. It collects the essential biographical and academic information required to create a student profile in the system. All fields marked in the form are mandatory and must be completed before the registration can be submitted. The system validates the matric number format, enforces a minimum password length of eight characters, and ensures that a valid email address is provided. Table 3.3 below illustrates the fields of the Student Registration Form.

STUDENT REGISTRATION FORM

Matric Number
e.g. YABATECH/2024/ND/CSC/001
First Name
Enter first name
Last Name
Enter last name
Email Address
Enter email address
Gender
Select: Male / Female
Level
Select: 100 / 200 / 300 / 400
Department
e.g. Computer Science
Phone Number
Enter phone number
Password
Min 8 characters
Next of Kin Name
Enter next of kin name
Next of Kin Phone
Enter next of kin phone


Table 3.3: Student Registration Form Fields

(b) Hostel Creation Form (Administrator)
This form is accessible exclusively to the system administrator and is used to register new hostel blocks into the system. The administrator specifies the hostel name, the gender of students permitted to reside in the hostel (male or female), the total bed space capacity, and a brief description of the hostel. Table 3.4 below illustrates the fields of the Hostel Creation Form.

HOSTEL CREATION FORM (ADMIN)

Hostel Name
e.g. Bakassi Hostel
Gender Allowed
Select: Male / Female
Total Capacity
Enter total capacity
Description
Enter hostel description


Table 3.4: Hostel Creation Form Fields

(c) Room Creation Form (Administrator)
Once a hostel block has been created, the administrator uses this form to add individual rooms to the hostel. The form captures the room number, the floor on which the room is located, the room type (Standard or Executive), and the maximum number of students the room can accommodate. The system automatically associates each new room with the hostel selected from the dropdown menu. Table 3.5 below illustrates the fields of the Room Creation Form.

ROOM CREATION FORM (ADMIN)

Hostel
Select hostel from dropdown
Room Number
e.g. B-204
Floor Number
e.g. 2
Room Type
Select: Standard / Executive
Capacity
e.g. 4


Table 3.5: Room Creation Form Fields

(d) Hostel Application Form (Student)
This form allows a registered and authenticated student to apply for hostel accommodation for the current academic session. The student is required to select up to three hostel preferences in order of priority. The student may also upload a payment receipt as evidence of hostel fee payment made to the institution. The academic session is automatically populated by the system based on the currently active session configured by the administrator. Table 3.6 below illustrates the fields of the Hostel Application Form.

HOSTEL APPLICATION FORM (STUDENT)

Academic Session
Auto-populated (e.g. 2024/2025)
1st Choice Hostel
Select from available hostels
2nd Choice Hostel
Select from available hostels
3rd Choice Hostel
Select from available hostels
Payment Receipt
Upload receipt image/PDF


Table 3.6: Hostel Application Form Fields




3.3.2 DATABASE DESIGN
The system utilizes Firebase Firestore, a cloud-hosted NoSQL document database, for data storage and retrieval. However, for the purposes of this academic report, the database schema is presented in the standard relational table format to clearly illustrate the data structure, field types, and relationships between entities. The following data dictionary tables describe the five core entities of the Hostel Management System.

Table Name: Students
Purpose: This table stores the registration details of all students who create an account on the platform. It serves as the primary reference for student identity verification and is linked to the Bookings table to track accommodation records.

FIELD NAME
FIELD TYPE
WIDTH
ID
Int
11
MATRIC_NO
Varchar
30
FULL_NAME
Text


DEPARTMENT
Varchar
100
LEVEL
Varchar
10
GENDER
Varchar
10
EMAIL
Varchar
100
PASSWORD
Text


DATE_CREATED
Datetime




Table Name: Rooms
Purpose: This table maintains a record of all hostel rooms available for booking. It stores the details of each room, including its location, capacity, pricing, and current occupancy status, enabling the system to display real-time availability to students.

FIELD NAME
FIELD TYPE
WIDTH
ID
Int
11
ROOM_NUMBER
Varchar
20
BLOCK_NAME
Varchar
50
CAPACITY
Int
5
CURRENT_OCCUPANCY
Int
5
PRICE
Double


GENDER_ALLOWED
Varchar
10
STATUS
Varchar
20


Table Name: Bookings
Purpose: This table records all room allocation transactions. Each entry represents a booking attempt by a student and tracks the payment status, administrative approval, and the academic session for which the booking was made.

FIELD NAME
FIELD TYPE
WIDTH
ID
Int
11
STUDENT_ID
Int
11
ROOM_ID
Int
11
PAYMENT_STATUS
Varchar
20
APPROVAL_STATUS
Varchar
20
BOOKING_DATE
Datetime


SESSION
Varchar
20


Table Name: Users
Purpose: This table stores the credentials and roles of all approved system administrators and hostel porters. It is used by the authentication module to verify administrative access and enforce role-based permissions within the platform.

FIELD NAME
FIELD TYPE
WIDTH
ID
Int
30
NAME
Text


USERNAME
Varchar
200
PASSWORD
Text


ROLE
Varchar
20
CREATED_AT
Datetime




Table Name: System Settings
Purpose: This table stores configurable information about the institution and the hostel management unit, such as the institution name, contact details, current academic session, and hostel registration deadlines. It allows administrators to update system-wide settings without modifying the application code.

FIELD NAME
FIELD TYPE
WIDTH
ID
Int
11
INSTITUTION_NAME
Varchar
200
CONTACT
Varchar
50
EMAIL
Varchar
100
CURRENT_SESSION
Varchar
20
REGISTRATION_DEADLINE
Datetime


DATE_UPDATED
Datetime







3.3.4 SYSTEM FLOWCHART
The system flowchart provides a visual representation of the logical sequence of operations that a user follows when interacting with the Hostel Management System. The following description outlines the process flow from start to finish.
The process begins at the Start terminal. The system first checks whether the user is a registered member of the platform. If the user is not registered, the system directs them to the Registration module, where they complete the Student Registration Form. Upon successful registration, the system displays a confirmation message and redirects the user to the Login page.
If the user is already registered, they proceed directly to the Login page where they enter their credentials (email and password). The system then performs an Authentication check. If the credentials are invalid, the system displays an error message indicating an invalid password. The user is then presented with the option to retry the login or to reset their password via the Forgot Password module. A successful password reset redirects the user back to the Login page.
Upon successful authentication, the user gains access to the Dashboard. From the dashboard, the student navigates to the hostel listing and selects a preferred block and room. The system then checks the real-time availability of the selected room. If the room is not available (i.e., its status is Full), the system returns the user to the room selection page to choose a different room.
If the selected room is available, the system proceeds to the Payment module, where the student completes the hostel fee payment through the integrated payment gateway. Upon successful payment, the system generates a Payment Confirmation and a downloadable digital Receipt. The student may then choose to Logout, which terminates the session and returns the process to the Stop terminal.
The flowchart captures the key decision points (Is Registered?, Authentication, Room Availability?) and process blocks (Registration, Login, Dashboard, Payment, Confirmation, Receipt Generation) that define the complete user journey within the Hostel Management System.





3.3.5 Use Case Diagram
Student Actor: Can register, submit applications, view status, and access digital credentials.
Admin Actor: Can configure hostels, manage whitelists, process allocations, and view reports.
Warden Actor: Can verify students via QR scan, search resident profiles, and log attendance.
Apply for Hostel Use Case: Includes steps for filling forms, uploading docs, and submitting.
Process Allocation Use Case: Includes reviewing eligibility and assigning a room.
Verify Resident Use Case: Includes scanning QR code and viewing validity status.
	
3.3.6 Data Flow Diagram (DFD)
Context Level (Level 0): The central "Hostel Management System" process handles inputs (applications, verifications) from Student, Admin, and Warden entities and generates outputs (notifications, reports).
Authentication Process: Validates user credentials against the User Store.
Application Processing: Receives student data, validates against Whitelist Store, and updates Allocation Store.
Reporting Process: Aggregates data from Allocation and Inventory Stores to generate admin analytics.

3.3.7 Entity Relationship Diagram (ERD)	
One-to-One Relationships: User to Student (One user account corresponds to one student profile).
One-to-Many Relationships: Hostel to Blocks, Blocks to Rooms, Rooms to Beds.
Many-to-One Relationships: Allocations to Students and Allocations to Beds (A bed has many historical allocations, but only one active one).
Allocation Constraints: Enforces that a Bed can have 0 or 1 active allocation at a time.
Whitelist Constraints: A Matriculation Number can appear once per Academic Session.
Inventory Constraints: A Room must belong to exactly one Block.













