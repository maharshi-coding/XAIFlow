from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.core.errors import api_error


def get_record(session: Session, model, record_id):
    record = session.get(model, record_id)
    if record is None:
        raise api_error(404, "NOT_FOUND", f"{model.__name__} was not found.")
    return record


def serialize(record, exclude=()):
    return {
        column.key: getattr(record, column.key)
        for column in inspect(record).mapper.column_attrs
        if column.key not in exclude
    }


def list_records(session, model, project_id=None, limit=200):
    query = select(model)
    if project_id:
        query = query.where(model.project_id == project_id)
    return session.scalars(query.order_by(model.created_at.desc()).limit(limit)).all()
