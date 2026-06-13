"""SQLAlchemy ORM models for the Scrumfolks TMS.

Every model is imported here so that `Base.metadata` knows about them. This
matters for Alembic autogeneration and for `create_all` in tests.
"""

from app.models.announcement import Announcement
from app.models.attendance import AttendanceLog
from app.models.attachment import FileAttachment
from app.models.brand import Brand
from app.models.daily_summary import DailySummary
from app.models.leave import LeaveRequest
from app.models.notification import Notification
from app.models.profile import Profile
from app.models.sop import SOPDocument
from app.models.task import Task, TaskChat

__all__ = [
    "Announcement",
    "AttendanceLog",
    "Brand",
    "DailySummary",
    "FileAttachment",
    "LeaveRequest",
    "Notification",
    "Profile",
    "SOPDocument",
    "Task",
    "TaskChat",
]
