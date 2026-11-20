'use client';

import { useMemo, type ReactNode } from 'react';
import { ApolloClient, ApolloProvider, HttpLink, InMemoryCache } from '@apollo/client';

export default function ApolloWrapper({ children }: { children: ReactNode }) {
  const client = useMemo(
    () =>
      new ApolloClient({
        link: new HttpLink({
          uri: process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql',
        }),
        cache: new InMemoryCache(),
      }),
    [],
  );
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
