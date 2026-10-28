import {describe,it,expect} from 'vitest';
import {AGENT_DOMAIN_KNOWLEDGE} from '@/lib/agent-knowledge';
import {frappePreferencesSchema,DEFAULT_FRAPPE_PREFERENCES} from '@/lib/frappe-preferences';
import {EXAMPLE_FILES,EXAMPLE_CONTENT} from '@/lib/github-example';
import {getAttachmentLabel,getMediaCategory} from '@/components/ai-elements/attachments';
describe('integration knowledge and safe preferences',()=>{
 it('distinguishes reference context from live access',()=>{expect(AGENT_DOMAIN_KNOWLEDGE).toContain('لا تدّع فحص مستودع');expect(AGENT_DOMAIN_KNOWLEDGE).toContain('لم يُفعّل OAuth');expect(AGENT_DOMAIN_KNOWLEDGE).toContain('docstatus');});
 it('validates fields, pagination, and site without retaining secrets',()=>{expect(frappePreferencesSchema.parse({...DEFAULT_FRAPPE_PREFERENCES,apiSecret:'not-stored'})).not.toHaveProperty('apiSecret');expect(frappePreferencesSchema.safeParse({...DEFAULT_FRAPPE_PREFERENCES,pageLength:101}).success).toBe(false);expect(frappePreferencesSchema.safeParse({...DEFAULT_FRAPPE_PREFERENCES,siteUrl:'http://localhost'}).success).toBe(false);});
 it('has content for every example file',()=>{EXAMPLE_FILES.forEach(f=>expect(EXAMPLE_CONTENT[f.id]).toBeTruthy());});
 it('renders labels for both files and document sources',()=>{expect(getAttachmentLabel({id:'1',type:'file',url:'data:text/plain,test',mediaType:'text/plain',filename:'notes.txt'})).toBe('notes.txt');expect(getMediaCategory({id:'2',type:'source-document',sourceId:'s',mediaType:'application/pdf',title:'مرجع'})).toBe('source');});
});