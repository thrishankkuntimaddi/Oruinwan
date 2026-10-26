import { describe, expect, it } from 'vitest';
import { definePeopleMatchTests } from '../../../platform/people/peopleMatch.cases.js';

// The same cases as the web app (client/src/__tests__/recipients.test.jsx).
definePeopleMatchTests({ describe, it, expect });
