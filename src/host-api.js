// DSH host request adapter: the single place that knows the host API prefix, the
// JSON POST envelope and the keepalive flag used by the profile-sync bridge.
// Imports nothing from workspace.js; callers keep their own response handling.
export const HOST_API='api/relationship-notes/';
export function hostPost(path,body,{signal,keepalive}={}){
 return fetch(HOST_API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body??{}),signal,keepalive});
}
