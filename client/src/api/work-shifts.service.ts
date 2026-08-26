import type { ApiEnvelope } from '../types/api';
import type {
  AssignUserWorkShiftInput,
  UserWorkShiftAssignment,
  UserWorkShiftAssignmentHistory,
  WorkShift,
} from '../types/work-shifts';
import instance from './http';
import { unwrapData } from './response';

export const getWorkShifts = async (signal?: AbortSignal): Promise<WorkShift[]> =>
  unwrapData(await instance.get<ApiEnvelope<WorkShift[]>, ApiEnvelope<WorkShift[]>>(
    'shared/work-shifts',
    { signal },
  ));

export const getUserWorkShiftAssignments = async (
  userId: string,
  signal?: AbortSignal,
): Promise<UserWorkShiftAssignmentHistory> =>
  unwrapData(await instance.get<
    ApiEnvelope<UserWorkShiftAssignmentHistory>,
    ApiEnvelope<UserWorkShiftAssignmentHistory>
  >('shared/user-work-shift-assignments', {
    params: { user_id: userId },
    signal,
  }));

export const assignUserWorkShift = async (
  input: AssignUserWorkShiftInput,
): Promise<UserWorkShiftAssignment> =>
  unwrapData(await instance.post<
    ApiEnvelope<UserWorkShiftAssignment>,
    ApiEnvelope<UserWorkShiftAssignment>
  >('shared/user-work-shift-assignments', input));
