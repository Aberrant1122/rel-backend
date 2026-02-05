# Notifications Frontend Integration Guide

## Quick Start

### 1. Fetch Notifications
```typescript
// In your frontend service (e.g., notificationsService.ts)
export const getNotifications = async (limit = 50, offset = 0) => {
  const response = await fetch(
    `${API_URL}/api/notifications?limit=${limit}&offset=${offset}`,
    {
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );
  return response.json();
};
```

### 2. Display Notifications
```typescript
interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  related_id: number | null;
  related_type: string | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

// Example component
const NotificationsList = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const result = await getNotifications();
    if (result.success) {
      setNotifications(result.data);
      setUnreadCount(result.unread);
    }
  };

  return (
    <div>
      <h2>Notifications ({unreadCount} unread)</h2>
      {notifications.map(notif => (
        <NotificationItem key={notif.id} notification={notif} />
      ))}
    </div>
  );
};
```

### 3. Mark as Read
```typescript
export const markNotificationAsRead = async (id: number) => {
  const response = await fetch(
    `${API_URL}/api/notifications/${id}/read`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );
  return response.json();
};

// Usage
const handleNotificationClick = async (notificationId: number) => {
  await markNotificationAsRead(notificationId);
  // Refresh notifications list
  fetchNotifications();
};
```

### 4. Mark All as Read
```typescript
export const markAllNotificationsAsRead = async () => {
  const response = await fetch(
    `${API_URL}/api/notifications/read-all`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );
  return response.json();
};
```

### 5. Delete Notification
```typescript
export const deleteNotification = async (id: number) => {
  const response = await fetch(
    `${API_URL}/api/notifications/${id}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );
  return response.json();
};
```

## UI Components Examples

### Notification Bell Icon with Badge
```tsx
const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Poll for new notifications every 30 seconds
    const interval = setInterval(async () => {
      const result = await getNotifications(1, 0);
      if (result.success) {
        setUnreadCount(result.unread);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <button className="relative">
      <BellIcon />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
};
```

### Notification Item Component
```tsx
const NotificationItem = ({ notification }: { notification: Notification }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <TaskIcon className="text-blue-500" />;
      case 'task_completed':
        return <CheckIcon className="text-green-500" />;
      default:
        return <BellIcon className="text-gray-500" />;
    }
  };

  const handleClick = async () => {
    if (!notification.is_read) {
      await markNotificationAsRead(notification.id);
    }
    
    // Navigate to related item if applicable
    if (notification.related_type === 'task' && notification.related_id) {
      router.push(`/tasks/${notification.related_id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
        !notification.is_read ? 'bg-blue-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {getIcon(notification.type)}
        <div className="flex-1">
          <h4 className="font-semibold">{notification.title}</h4>
          <p className="text-sm text-gray-600">{notification.message}</p>
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(notification.created_at))} ago
          </span>
        </div>
        {!notification.is_read && (
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
        )}
      </div>
    </div>
  );
};
```

### Notification Dropdown
```tsx
const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    const result = await getNotifications(10, 0);
    if (result.success) {
      setNotifications(result.data);
      setUnreadCount(result.unread);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead();
    fetchNotifications();
  };

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}>
        <BellIcon />
        {unreadCount > 0 && (
          <span className="badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg z-50">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-blue-500 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.map(notif => (
                <NotificationItem key={notif.id} notification={notif} />
              ))
            )}
          </div>

          <div className="p-3 border-t text-center">
            <Link href="/notifications" className="text-sm text-blue-500 hover:underline">
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
```

## Real-time Updates (Optional)

For real-time notifications, consider implementing WebSocket or polling:

### Polling Approach
```typescript
// In your app layout or main component
useEffect(() => {
  const pollInterval = setInterval(async () => {
    const result = await getNotifications(1, 0);
    if (result.success && result.unread > 0) {
      // Update notification count in your state management
      dispatch(setUnreadCount(result.unread));
    }
  }, 30000); // Poll every 30 seconds

  return () => clearInterval(pollInterval);
}, []);
```

### WebSocket Approach (Future Enhancement)
```typescript
// Connect to WebSocket server
const ws = new WebSocket('ws://localhost:5000');

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  // Add notification to state
  dispatch(addNotification(notification));
  // Show toast notification
  toast.info(notification.title);
};
```

## Notification Types Reference

| Type | Description | Related Type | Action |
|------|-------------|--------------|--------|
| `task_assigned` | Task assigned to user | `task` | Navigate to task details |
| `task_completed` | Task marked as completed | `task` | Navigate to task details |

## Best Practices

1. **Polling Frequency**: Don't poll too frequently (30-60 seconds is reasonable)
2. **Pagination**: Load notifications in batches to improve performance
3. **Mark as Read**: Mark notifications as read when user clicks on them
4. **Visual Indicators**: Use badges, colors, or icons to distinguish unread notifications
5. **Sound/Toast**: Consider showing toast notifications for new items
6. **Cleanup**: Delete old read notifications periodically
7. **Error Handling**: Handle API errors gracefully

## Example Service File

```typescript
// services/notificationsService.ts
import api from './api';

export const notificationsService = {
  getNotifications: async (limit = 50, offset = 0) => {
    const response = await api.get(`/notifications?limit=${limit}&offset=${offset}`);
    return response.data;
  },

  markAsRead: async (id: number) => {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.patch('/notifications/read-all');
    return response.data;
  },

  deleteNotification: async (id: number) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },
};
```

## Testing

Test the notifications by:
1. Creating a task and assigning it to another user
2. Logging in as that user
3. Checking the notifications endpoint
4. Marking notifications as read
5. Completing a task and checking the creator's notifications
