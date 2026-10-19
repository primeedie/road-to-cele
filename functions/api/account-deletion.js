import {handleAccountDeletion} from '../../server/account-deletion.mjs';
export const onRequest=context=>handleAccountDeletion(context.request,context.env);
