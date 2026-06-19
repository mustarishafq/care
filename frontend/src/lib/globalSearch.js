import { db } from '@/api/db';

export async function searchComplaints(query, limit = 10) {
  return db.entities.Complaint.filter({ search: query }, '-created_date', limit);
}

export async function searchUsers(query, limit = 10) {
  return db.entities.User.filter({ search: query }, 'full_name', limit);
}
