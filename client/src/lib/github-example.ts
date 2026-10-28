import type { GithubItem } from './github.functions';
export const EXAMPLE_REPO:GithubItem={id:'example',name:'alazab-maintenance',owner:'alazab-example',label:'alazab-example/alazab-maintenance',description:'مثال تجريبي لتطبيق Frappe لإدارة طلبات الصيانة بمجموعة العزب',ref:'main',private:true};
export const EXAMPLE_FILES:GithubItem[]=[{id:'README.md',name:'README.md',path:'README.md',type:'file',size:320},{id:'hooks.py',name:'hooks.py',path:'hooks.py',type:'file',size:260},{id:'maintenance_request.json',name:'maintenance_request.json',path:'maintenance_request.json',type:'file',size:450}];
export const EXAMPLE_CONTENT:Record<string,string>={
 'README.md':'# Alazab Maintenance\n\nمثال تجريبي — ليس مستودعاً حقيقياً.\nتطبيق Frappe لتنظيم طلبات الصيانة ومتابعة الفنيين.\n\nDocType: Maintenance Request\nالحقول: customer, project, priority, status\n',
 'hooks.py':'app_name = "alazab_maintenance"\napp_title = "Alazab Maintenance"\napp_publisher = "Alazab example"\napp_description = "Illustrative maintenance workflow"\n',
 'maintenance_request.json':JSON.stringify({doctype:'DocType',name:'Maintenance Request',module:'Alazab Maintenance',fields:[{fieldname:'customer',fieldtype:'Link',options:'Customer'},{fieldname:'priority',fieldtype:'Select',options:'Low\nMedium\nHigh'}]},null,2),
};
export const EXAMPLE_COMMITS:GithubItem[]=[{id:'example-1',name:'إضافة نموذج طلبات الصيانة',label:'تجريبي 01',description:'فريق العزب — مثال'},{id:'example-2',name:'تحديث توثيق سير العمل',label:'تجريبي 02',description:'فريق العزب — مثال'}];