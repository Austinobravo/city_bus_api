

import { getApiDocs } from '@/lib/swagger';
import PageContent from './page-content';

export default async function SwaggerPage() {
  const spec = getApiDocs();
  return <PageContent spec={spec} />;
}

