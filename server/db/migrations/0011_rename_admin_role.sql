-- The platform admin role was renamed from chttrix_admin to oruinwan_admin.
UPDATE users
   SET roles = array_replace(roles, 'chttrix_admin', 'oruinwan_admin')
 WHERE 'chttrix_admin' = ANY (roles);
