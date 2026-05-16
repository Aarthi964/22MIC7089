# Stage 1
Campus Notifications Microservice – REST API Design & Real-Time Strategy

To support a robust campus notification platform (covering Placements, Events, and Results), the platform must support the following core actions:
1. Fetch Notifications: Retrieve a paginated list of notifications for the logged-in student.
2. Mark as Read: Update the status of specific notifications to 'read' so they disappear or change visual state on the front-end.
3. Get Unread Count: Quickly fetch the total number of unread alerts to display a badge count on the UI notification icon.
4. Real-Time Stream: Establish a persistent connection to push new alerts instantly to active users.

---

REST API Endpoints & Contract Design

### Base URL
`https://api.campusnotifications.cluster/v1`

### Authentication Header (Required for all requests)
```http
Authorization: Bearer <JWT_TOKEN>

Endpoint 1: Fetch Notifications - Retrieves a list of notifications tailored to the logged-in student, supporting pagination and category filtering.

        Method: GET
        Path: /notifications
        Query Parameters:
            1. page (integer, optional, default: 1)

            2. limit (integer, optional, default: 10)

            3. category (string, optional, values: PLACEMENT, EVENT, RESULT)
        Sample Response
        {
        "success": true,
        "data": {
            "notifications": [
                {
                    "id": "notif_987654321",
                    "title": "Google Placement Drive - Shortlist Out",
                    "message": "Congratulations! You have been shortlisted for the technical interview round. Check your email for slot booking.",
                    "category": "PLACEMENT",
                    "isRead": false,
                    "createdAt": "2026-05-16T10:30:00Z"
                }
            ],
            "pagination": {
                "currentPage": 1,
                "totalPages": 5,
                "totalItems": 48,
                "hasNextPage": true
            }
        }
    }

Endpoint 2: Mark Notification(s) as Read - Updates the state of one or more notifications to read.

        Method: PUT
        Path: /notifications/read
        Sample Request Body
        {
            "notificationIds": [
                "notif_987654321"
            ]
        }
        Sample Response
        {
            "success": true,
            "message": "Notifications successfully marked as read",
            "updatedIds": [
                "notif_987654321"
            ]
        }
Endpoint 3: Get Unread Notification Count - Provides an ultra-fast lookup for UI badge counters.

        Method: GET
        Path: /notifications/unread-count
        Sample Response
        {
        "success": true,
        "data": {
                "unreadCount": 7,
                "breakdown": {
                "PLACEMENT": 2,
                "EVENT": 4,
                "RESULT": 1
                }
            }
        }
3. Real-Time Notification Mechanism
    To deliver real-time updates for high-priority campus events (like sudden placement announcements or result publications), we will implement Server-Sent Events (SSE).
    Prefer SSE over WebSockets as it is uni-directional data flow. The campus notification system only requires the server to push updates to the client. The client does not need to send messages back upstream via the persistent connection.SSE automatically handles connection drops and reconnections out of the box with built-in retry delays. And also operates purely over standard HTTP/2, saving overhead and reducing complex load-balancing configurations.

    Real-Time Connection Details
    Method: GET
    Path: /notifications/stream

    Sample Pushed Event Payload Data
    Whenever a coordinator posts a new notification, the backend instantly pushes this event to connected students matching the target criteria:

    HTTP event: notification
    data: {"id": "notif_778899", "title": "End Semester Results Declared", "message": "The results for the 6th Semester B.Tech exams are now active on the portal.", "category": "RESULT", "createdAt": "2026-05-16T12:00:00Z"}




# Stage 2
Database Design, Scalability Strategy & Access Queries

For the campus notification microservice, **PostgreSQL (Relational Database Management System)** is chosen as the primary persistent storage. 

### Reasons for choosing PostgreSQL
ACID Compliance: Transactions (like marking a notification as read while concurrently adding a new one) require strict isolation to prevent race conditions or data discrepancy.

Efficient Indexing and Relational Integrity: We have a strong structural relationship between a user (student) and their notifications. PostgreSQL handles join operations, foreign keys, and indexes (`B-Tree` and `BRIN`) exceptionally well.

JSONB Support: Notifications often carry dynamic, category-specific metadata (e.g., event venue, placement deadline links, or result marks links). PostgreSQL’s `JSONB` column type allows us to store and index semi-structured data without losing relational integrity.

Scale-Out and Read Replicas: Since a notification system is read-heavy (students constantly checking alerts), PostgreSQL allows us to scale horizontally using read-replicas.




## 2. Database Schema Design

We will use two core tables: `users` (as a reference point for authentication/targeting) and `notifications`. To handle the scale of individual read statuses efficiently without bloating a join table unnecessarily, we use an array-based or multi-row schema. For standard relational robustness at scale, a specialized junction/state architecture is best.

### Database Schema DDL
-- 1. Users Table (Core Reference)
CREATE TABLE users (
    user_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'STUDENT', -- STUDENT, COORDINATOR, ADMIN
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Notifications Table
CREATE TYPE notification_category AS ENUM ('PLACEMENT', 'EVENT', 'RESULT');

CREATE TABLE notifications (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    category notification_category NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB -- Dynamic contextual data like links, dates, etc.
);

-- 3. User Notification State Table (Tracks delivery and read status per user)
CREATE TABLE user_notifications (
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
    notification_id VARCHAR(50) REFERENCES notifications(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, notification_id)
);

Challenges faced include Slowing Read Queries, High Write Contention for Massive broadcast operations (e.g., sending a single placement alert to 10,000 students at once) will spike disk I/O operations and locks. These can be overcome by database partitioning, caching and using message queues like Kafka.


Fetch Notifications
SELECT 
    n.id, 
    n.title, 
    n.message, 
    n.category, 
    un.is_read AS "isRead", 
    n.created_at AS "createdAt"
FROM user_notifications un
JOIN notifications n ON un.notification_id = n.id
WHERE un.user_id = :userId 
  AND n.category = 'PLACEMENT' -- Optional Category Filter
ORDER BY n.created_at DESC
LIMIT 10 OFFSET 0;

Mark Notifications as Read
UPDATE user_notifications
SET 
    is_read = TRUE,
    read_at = CURRENT_TIMESTAMP
WHERE user_id = :userId 
  AND notification_id IN ('notif_987654321');

Get Unread Notification Count
SELECT 
    COUNT(*) AS "unreadCount",
    COUNT(CASE WHEN n.category = 'PLACEMENT' THEN 1 END) AS "PLACEMENT",
    COUNT(CASE WHEN n.category = 'EVENT' THEN 1 END) AS "EVENT",
    COUNT(CASE WHEN n.category = 'RESULT' THEN 1 END) AS "RESULT"
FROM user_notifications un
JOIN notifications n ON un.notification_id = n.id
WHERE un.user_id = :userId 
  AND un.is_read = FALSE;



# Stage 3
The original query is not efficient. Without a composite index matching the target filter criteria, the database will scan all 5,000,000 rows to find records matching `studentID = 1042` and `isRead = false`. The query has `ORDER BY createdAt DESC`. Without an index, the database must load the matching rows into memory and perform sorting before returning data. Fetching all columns unnecessarily increases network payload sizes. A composite index covering (studentID, isRead, createdAt DESC) must be added.

Query for fetching users who received placement notification in previous 7 days. This is based on the above mentioned schema:

SELECT DISTINCT un.user_id AS "studentID"
FROM user_notifications un
JOIN notifications n ON un.notification_id = n.id
WHERE n.notificationType = 'Placement'
  AND n.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days';


# Stage 4
Fetching unread notifications on every page load is costly. Using caching for user notifications can be a solution. But for sometime the data will be stale. Immediate notifications won't be sent. Another solution can be read replicas by using Master-Slave architecture for database where we have multiple read replicas with one or fewer write DBs.