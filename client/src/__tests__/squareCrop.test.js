import { describe, expect, it } from 'vitest';
import { defineSquareCropTests } from '@platform/media/squareCrop.cases.js';

// The same cases as the phone app (mobile/src/features/home/quickJump.test.js).
defineSquareCropTests({ describe, it, expect });
