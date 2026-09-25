import { Router } from 'express';
import { classAssignments, create, edit, index, show, store, teacherAssignments, update } from '../controllers/teacher-assignment.controller.js';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const teacherAssignmentRoutes = Router();

teacherAssignmentRoutes.use(requireAuth);
teacherAssignmentRoutes.get('/teacher-assignments', requirePermission('teacher_assignment.view'), csrfToken, index);
teacherAssignmentRoutes.get('/teacher-assignments/new', requirePermission('teacher_assignment.create'), csrfToken, create);
teacherAssignmentRoutes.post('/teacher-assignments', requirePermission('teacher_assignment.create'), verifyCsrf, store);
teacherAssignmentRoutes.get('/teacher-assignments/classes/:classId', requirePermission('teacher_assignment.view'), csrfToken, classAssignments);
teacherAssignmentRoutes.get('/teacher-assignments/teachers/:teacherId', requirePermission('teacher_assignment.view'), csrfToken, teacherAssignments);
teacherAssignmentRoutes.get('/teacher-assignments/:id', requirePermission('teacher_assignment.view'), csrfToken, show);
teacherAssignmentRoutes.get('/teacher-assignments/:id/edit', requirePermission('teacher_assignment.edit'), csrfToken, edit);
teacherAssignmentRoutes.post('/teacher-assignments/:id', requirePermission('teacher_assignment.edit'), verifyCsrf, update);
