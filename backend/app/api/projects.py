from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Project
from app.schemas.requests import ProjectCreate, ProjectUpdate
from app.schemas.responses import ProjectOut
from app.services.common import get_record, list_records, serialize
from app.services.projects import delete_project as delete_project_service

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=list[ProjectOut])
def projects(db: Session = Depends(get_db)):
    return [serialize(item) for item in list_records(db, Project)]


@router.post("", status_code=201, response_model=ProjectOut)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(**body.model_dump())
    db.add(project)
    db.commit()
    return serialize(project)


@router.get("/{project_id}", response_model=ProjectOut)
def project_detail(project_id: str, db: Session = Depends(get_db)):
    return serialize(get_record(db, Project, project_id))


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, body: ProjectUpdate, db: Session = Depends(get_db)):
    project = get_record(db, Project, project_id)
    for key, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(project, key, value)
    db.commit()
    return serialize(project)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = get_record(db, Project, project_id)
    delete_project_service(db, project)
    return Response(status_code=204)
