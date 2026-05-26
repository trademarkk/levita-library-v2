import { handleApiRequest } from '../server/api.mjs';

export default function handler(request, response) {
  return handleApiRequest(request, response);
}
