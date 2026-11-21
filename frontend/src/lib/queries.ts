import { gql } from '@apollo/client';

// M0 health probe (still valid against the scaffold API).
export const HELLO_QUERY = gql`
  query Hello {
    hello
    health {
      status
      service
      version
    }
  }
`;

// M1 domain operations (TDD Section 2.1) are NOT yet served by the backend.
// Until the domain schema lands, pages use the stub API in ./stub-api.ts,
// which returns the same shapes. When the SDL ships, define the operations
// here, run `npm run codegen`, and swap the stub calls for Apollo hooks.
