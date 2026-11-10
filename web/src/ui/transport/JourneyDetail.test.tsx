import { describe, expect, it, vi } from 'vitest';
vi.mock('../../transport/saveJourney',()=>({confirmJourneyReview:vi.fn()}));
import { renderToStaticMarkup } from 'react-dom/server';
import { ServiceCard } from './JourneyDetail';
import type { ServiceView } from '../../transport/viewModel';
const service:ServiceView={id:'s',ord:0,service:'Hikari 646',status:'to_book',statusLabel:'To book',departLabel:'Time not set',arriveLabel:'Time not set'};
describe('service ticket links',()=>{
  it('renders safe booking links with a new tab and accessible service context',()=>{
    const html=renderToStaticMarkup(<ServiceCard index={0} service={{...service,bookingUrl:'https://smart-ex.jp/en/'}}/>);
    expect(html).toContain('href="https://smart-ex.jp/en/"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('for Hikari 646 (opens in new tab)');
  });
  it('does not render unsafe links from imported or cached data',()=>{
    for(const bookingUrl of ['javascript:alert(1)','data:text/html,test','invalid']) {
      const html=renderToStaticMarkup(<ServiceCard index={0} service={{...service,bookingUrl}}/>);
      expect(html).not.toContain('Booking / tickets');
    }
  });
});
