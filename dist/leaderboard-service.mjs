function normalizeRow(row,batch){
 if(!row||!Number.isInteger(row.rank)||row.rank<1||!Number.isInteger(row.completed_courses)||!Number.isInteger(row.required_courses)||row.required_courses<1||row.completed_courses<0||row.completed_courses>row.required_courses||typeof row.percentage!=='number'||row.percentage<0||row.percentage>100||typeof row.anonymous_label!=='string'||!new RegExp('^Anon '+batch+' #[0-9]{4,}$').test(row.anonymous_label)||!(row.display_name===null||typeof row.display_name==='string'&&[...row.display_name].length<=60))throw Error('The leaderboard response could not be read. Please refresh.');
 return {rank:row.rank,completed:row.completed_courses,required:row.required_courses,percentage:row.percentage,name:row.display_name||row.anonymous_label,anonymous:!row.display_name,self:row.is_self===true};
}
export async function loadBatchLeaderboard(client,{batch,seed,page=0}={}){
 const {data,error}=await client.rpc('get_batch_leaderboard_v2',{p_alias_seed:seed,p_page:page,p_page_size:50});
 if(error){const failure=Error(error.code==='PGRST202'?'The batch leaderboard is awaiting setup.':'The leaderboard could not load. Please try again.');failure.setupRequired=error.code==='PGRST202';throw failure;}
 if(!data||data.batch_id!==batch||!Array.isArray(data.rows)||data.rows.length>50||!Number.isInteger(data.total_users)||data.total_users<0||data.page!==page||data.page_size!==50)throw Error('Your batch changed. Refresh the leaderboard.');
 return {batch,total:data.total_users,page,pageSize:50,rows:data.rows.map(row=>normalizeRow(row,batch)),self:data.self?normalizeRow(data.self,batch):null};
}
