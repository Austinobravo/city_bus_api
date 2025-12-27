'use client';

import { useEffect, useRef } from 'react';
import 'swagger-ui-dist/swagger-ui.css';

// Use dynamic import since SwaggerUIBundle is a UMD bundle
export default function PageContent({ spec }: { spec: any }) {
  const swaggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadSwagger() {
      const { SwaggerUIBundle } = await import('swagger-ui-dist');
      SwaggerUIBundle({
        domNode: swaggerRef.current!,
        spec,
        layout: 'BaseLayout',
      });
    }

    loadSwagger();
  }, [spec]);

  return <div className="swagger-ui" ref={swaggerRef} />;
}
