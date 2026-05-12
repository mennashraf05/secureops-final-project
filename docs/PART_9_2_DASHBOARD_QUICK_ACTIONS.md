# Part 9.2 Dashboard Quick Actions

Part 9.2 connects the Admin Dashboard quick action buttons to the correct admin workflows without pretending unfinished modules are complete.

## Behavior

- Add Product navigates from `/admin/dashboard` to `/admin/products?action=add`.
- The Products page detects `action=add`, opens the existing Add Product form automatically, then clears the query parameter with history replacement so refreshes do not reopen it forever.
- Open Security Center navigates to `/admin/security`.
- Verify File Integrity stays visible on the dashboard and shows: `File integrity verification will be available after Secure File Vault integration.`
- Run Attack Simulation navigates to `/admin/attack-simulation`.
- The Attack Simulation page is intentionally marked as backend pending, with simulation buttons disabled until the Attack Simulation backend is implemented.

## Browser Test Flow

1. Login as admin.
2. Open `/admin/dashboard`.
3. Click Add Product.
4. Confirm `/admin/products` opens and Add Product form is visible.
5. Click Open Security Center.
6. Confirm `/admin/security` opens.
7. Click Verify File Integrity.
8. Confirm a clear coming-soon/disabled message appears.
9. Click Run Attack Simulation.
10. Confirm it navigates to `/admin/attack-simulation` or shows coming-soon message.

## Notes

- No File Service or Secure File Vault integrity backend was added in this part.
- No Attack Simulation backend was added in this part.
- No mock verification or attack results are created.
- User dashboard behavior is unchanged.
