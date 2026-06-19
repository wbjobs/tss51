import axios from 'axios';
import type { Server, CreateServerDto, UpdateServerDto } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const serversApi = {
  getAll: () => api.get<Server[]>('/servers'),
  getOne: (id: string) => api.get<Server>(`/servers/${id}`),
  create: (data: CreateServerDto) => api.post<Server>('/servers', data),
  update: (id: string, data: UpdateServerDto) => api.put<Server>(`/servers/${id}`, data),
  remove: (id: string) => api.delete(`/servers/${id}`),
};

export const sshApi = {
  connect: (id: string) => api.post(`/ssh/connect/${id}`),
  disconnect: (id: string) => api.delete(`/ssh/disconnect/${id}`),
  connectAll: () => api.post('/ssh/connect-all'),
  disconnectAll: () => api.post('/ssh/disconnect-all'),
};

export default api;
