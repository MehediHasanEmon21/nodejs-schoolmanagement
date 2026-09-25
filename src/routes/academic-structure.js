import { Router } from 'express';
import {
  classCreate,
  classEdit,
  classesIndex,
  classStore,
  classUpdate,
  sectionCreate,
  sectionEdit,
  sectionsIndex,
  sectionStore,
  sectionUpdate,
  subjectCreate,
  subjectEdit,
  subjectsIndex,
  subjectStore,
  subjectUpdate,
} from '../controllers/academic-structure.controller.js';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const academicStructureRoutes = Router();

academicStructureRoutes.use(requireAuth);

academicStructureRoutes.get('/classes', requirePermission('academic_structure.view'), csrfToken, classesIndex);
academicStructureRoutes.get('/classes/new', requirePermission('academic_structure.create'), csrfToken, classCreate);
academicStructureRoutes.post('/classes', requirePermission('academic_structure.create'), verifyCsrf, classStore);
academicStructureRoutes.get('/classes/:id/edit', requirePermission('academic_structure.edit'), csrfToken, classEdit);
academicStructureRoutes.post('/classes/:id', requirePermission('academic_structure.edit'), verifyCsrf, classUpdate);

academicStructureRoutes.get('/sections', requirePermission('academic_structure.view'), csrfToken, sectionsIndex);
academicStructureRoutes.get('/sections/new', requirePermission('academic_structure.create'), csrfToken, sectionCreate);
academicStructureRoutes.post('/sections', requirePermission('academic_structure.create'), verifyCsrf, sectionStore);
academicStructureRoutes.get('/sections/:id/edit', requirePermission('academic_structure.edit'), csrfToken, sectionEdit);
academicStructureRoutes.post('/sections/:id', requirePermission('academic_structure.edit'), verifyCsrf, sectionUpdate);

academicStructureRoutes.get('/subjects', requirePermission('academic_structure.view'), csrfToken, subjectsIndex);
academicStructureRoutes.get('/subjects/new', requirePermission('academic_structure.create'), csrfToken, subjectCreate);
academicStructureRoutes.post('/subjects', requirePermission('academic_structure.create'), verifyCsrf, subjectStore);
academicStructureRoutes.get('/subjects/:id/edit', requirePermission('academic_structure.edit'), csrfToken, subjectEdit);
academicStructureRoutes.post('/subjects/:id', requirePermission('academic_structure.edit'), verifyCsrf, subjectUpdate);
