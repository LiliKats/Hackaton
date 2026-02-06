import api from './api';
import { LeaveRequest } from '@/types';

export const leaveRequestsService = {
  async getAll(): Promise<LeaveRequest[]> {
    const response = await api.get<LeaveRequest[]>('/leave-requests');
    return response.data;
  },

  async getByUser(userId: string): Promise<LeaveRequest[]> {
    const response = await api.get<LeaveRequest[]>(`/leave-requests/user/${userId}`);
    return response.data;
  },

  async getById(id: string): Promise<LeaveRequest> {
    const response = await api.get<LeaveRequest>(`/leave-requests/${id}`);
    return response.data;
  },

  async create(data: Partial<LeaveRequest> & { userId: string }): Promise<LeaveRequest> {
    const response = await api.post<LeaveRequest>('/leave-requests', data);
    return response.data;
  },

  async approve(id: string, approverId: string): Promise<LeaveRequest> {
    const response = await api.patch<LeaveRequest>(`/leave-requests/${id}/approve`, {
      approverId,
    });
    return response.data;
  },

  async reject(id: string, approverId: string, reason: string): Promise<LeaveRequest> {
    const response = await api.patch<LeaveRequest>(`/leave-requests/${id}/reject`, {
      approverId,
      reason,
    });
    return response.data;
  },

  async update(id: string, data: Partial<LeaveRequest>): Promise<LeaveRequest> {
    const response = await api.put<LeaveRequest>(`/leave-requests/${id}`, data);
    return response.data;
  },

  async cancel(id: string): Promise<LeaveRequest> {
    const response = await api.patch<LeaveRequest>(`/leave-requests/${id}/cancel`, {});
    return response.data;
  },
};
