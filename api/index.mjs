import { handleApiRequest } from '../server/api.mjs';

export default function handler(request, response) {
  const url = new URL(request.url, `https://${request.headers.host || 'localhost'}`);
  const path = url.searchParams.get('path');

  if (path) {
    url.searchParams.delete('path');
    request.url = `/api/${path.replace(/^\/+/, '')}${url.search}`;
  }

  return handleApiRequest(request, response);
}
