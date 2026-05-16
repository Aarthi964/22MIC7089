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