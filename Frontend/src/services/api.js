// src/services/api.js

const API_URL = 'http://localhost:3000/songs';


export async function fetchSongs() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export async function getSong(id) {
  const res = await fetch(`${API_URL}/${id}`);
  if (!res.ok) throw new Error('Failed to fetch song');
  return res.json();
}

export async function addSong(song) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(song),
  });
  if (!res.ok) throw new Error('Failed to add song');
  return res.json();
}

export async function patchSong(id, patch) {
  const res = await fetch(`${API_URL}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
}

export async function deleteSong(id) {
  const res = await fetch(`${API_URL}/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete');
  return true;
}
