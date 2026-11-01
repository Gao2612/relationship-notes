import { apply as replies } from './reply-service.js';
import { apply as imports } from './import-service.js';
export function apply(ctx) { replies(ctx); imports(ctx); }
