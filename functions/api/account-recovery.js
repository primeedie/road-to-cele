import {handleRecovery} from '../../server/account-recovery.mjs';
export const onRequest=({request,env})=>handleRecovery(request,env);
