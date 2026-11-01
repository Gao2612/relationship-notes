import { apply as replies } from './reply-service.js';
import { apply as imports } from './import-service.js';
import { apply as profiles } from './profile-service.js';
import { apply as interpretations } from './interpretation-service.js';
export function apply(ctx) { replies(ctx); imports(ctx); profiles(ctx); interpretations(ctx); }
