export const WORKSPACE_PATH = "/workspace";
export const PROFILE_PATH = "/workspace/profile";
export const NEW_BUSINESS_PATH = "/workspace/businesses/new";
export const editBusinessPath = (id: string) => `/workspace/businesses/${encodeURIComponent(id)}/edit`;
