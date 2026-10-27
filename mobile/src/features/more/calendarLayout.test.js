import { describe, expect, it } from 'vitest';
import { defineCalendarLayoutTests } from '../../../../platform/calendar/calendarLayout.cases.js';

// The same cases as the web app (client/src/__tests__/calendarLayout.test.js).
defineCalendarLayoutTests({ describe, it, expect });
