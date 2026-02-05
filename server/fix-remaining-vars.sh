#!/bin/bash

# Fix unused variables by prefixing with underscore
find src -type f -name "*.js" -exec sed -i '' \
  -e 's/} catch (err)/} catch (_err)/g' \
  -e 's/} catch (error)/} catch (_error)/g' \
  -e 's/} catch (emailError)/} catch (_emailError)/g' \
  -e 's/} catch (auditError)/} catch (_auditError)/g' \
  -e 's/} catch (notificationError)/} catch (_notificationError)/g' \
  {} +

echo "✅ Batch fix completed"
