import { describe, expect, it } from 'vitest';
import { defineCalendarLayoutTests } from '@platform/calendar/calendarLayout.cases.js';

// The same cases as the phone app (mobile/src/features/more/calendarLayout.test.js).
defineCalendarLayoutTests({ describe, it, expect });
