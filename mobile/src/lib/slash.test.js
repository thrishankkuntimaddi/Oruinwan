import { describe, expect, it } from 'vitest';
import { defineCommandTests } from '../../../platform/commands/commands.cases.js';

// The same cases as the web app (client/src/__tests__/slashCommands.test.js).
defineCommandTests({ describe, it, expect });
