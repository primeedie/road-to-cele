import {handleAdminAccess} from '../../server/admin-access.mjs';
export const onRequest=context=>handleAdminAccess(context.request,context.env);
