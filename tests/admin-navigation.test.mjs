import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { activeWorkspaceLink, groupAdminNavigation } from '../src/lib/admin-navigation.ts';
import { navFor, adminLandingPath, can } from '../src/lib/admin-permissions.ts';

const roles = ['owner','executive_associate','support','affiliate_manager','growth_gaming_lead','writer','editor','analyst'];
test('grouped navigation retains every permitted route exactly once and adds no access', () => {
  for (const role of roles) for (const overrides of [{}, {view_company_finance:true,growth_community:false}]) {
    const permitted = navFor(role,overrides);
    const visible = groupAdminNavigation(permitted).flatMap(group => group.items);
    assert.deepEqual(visible.map(item => item.href).sort(),permitted.map(item => item.href).sort());
    assert.equal(new Set(visible.map(item => item.href)).size,visible.length);
    for (const item of permitted) {
      assert.equal(can(role,item.capability,overrides),true);
      const page = item.href === '/admin' ? 'page.tsx' : item.href.slice('/admin/'.length)+'/page.tsx';
      assert.ok(existsSync(new URL('../src/app/admin/(command)/'+page,import.meta.url)),item.href+' has no route');
    }
    assert.ok(permitted.some(item => item.href === adminLandingPath(role,overrides)),role+' has no reachable home');
    assert.deepEqual(groupAdminNavigation(permitted,'does-not-exist'),[]);
  }
});
test('nested sections select the most specific page without selecting similarly named paths', () => {
  const nav = navFor('owner');
  assert.equal(activeWorkspaceLink(nav,'/admin/emails/renewals')?.href,'/admin/emails/renewals');
  assert.equal(activeWorkspaceLink(nav,'/admin/emails/branding')?.href,'/admin/emails');
  assert.equal(activeWorkspaceLink(nav,'/admin/team/payment-details')?.href,'/admin/team/payment-details');
  assert.equal(activeWorkspaceLink(nav,'/admin/support/follow-ups')?.href,'/admin/support/follow-ups');
  assert.equal(activeWorkspaceLink(nav,'/admin/partners-old'),undefined);
  assert.equal(activeWorkspaceLink(nav,'/admin')?.href,'/admin');
  const programme = [{href:'/partners',label:'Overview'},{href:'/partners/support',label:'Support'}];
  assert.equal(activeWorkspaceLink(programme,'/partners/support/ticket')?.label,'Support');
});
test('page search cannot reveal unavailable tools and future links are never discarded', () => {
  assert.equal(groupAdminNavigation(navFor('owner'),'renewals')[0].items[0].href,'/admin/emails/renewals');
  assert.equal(groupAdminNavigation(navFor('support'),'renewals').length,0);
  assert.equal(groupAdminNavigation(navFor('writer'),'company').length,1);
  assert.equal(groupAdminNavigation([{href:'/admin/future',label:'Future tool'}])[0].items[0].href,'/admin/future');
});
