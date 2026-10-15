import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summary,faqs} from '../src/lib/facts';

test('public facts defer paid availability to the configured billing page',()=>{
 assert.ok(summary.includes('Billing for current paid-plan availability'));
 assert.ok(!summary.includes('not a launched subscription service'));
 assert.ok(faqs.find(f=>f.q==='Can I create a unique image from a prompt?')?.a.startsWith('When live generation is available'));
});
test('Scan Lab refers prompt generation to the capability-aware studio',()=>{
 const source=readFileSync('src/components/art-studio.tsx','utf8');
 assert.ok(!source.includes('generation is not connected yet'));
 assert.ok(source.includes('check generator availability'));
});
test('AI panel claims live generation and quota only after the capability check',()=>{
 const source=readFileSync('src/components/ai-art-panel.tsx','utf8');
 assert.ok(source.includes('service?.enabled ? "Live AI artwork" : "AI artwork"'));
 assert.ok(source.includes('service?.enabled && <span className="ai-art-limit">{service.dailyLimit}'));
});
test('pricing is discoverable and remains connected to real billing',()=>{
 assert.ok(readFileSync('src/components/brand.tsx','utf8').includes('<Link href="/pricing">Pricing</Link>'));
 assert.ok(readFileSync('src/app/pricing/page.tsx','utf8').includes("redirect('/billing')"));
});
