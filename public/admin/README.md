# Khaacho Admin Panel

Simple, fast admin interface for managing the Khaacho B2B platform.

## Features

### Dashboard
- Total orders today
- Total outstanding credit
- Active retailers count
- Active vendors count
- Recent orders list
- Overdue accounts monitoring

### Retailer Management
- View all retailers
- Approve pending retailers
- Assign credit limits
- Update credit limits
- Search and filter retailers
- View credit scores and outstanding debt

### Vendor Management
- View all vendors
- Approve pending vendors
- View vendor statistics
- Monitor vendor products

### Order Management
- View all orders
- Create manual orders
- Edit draft orders before confirmation
- Confirm orders
- Assign vendors to orders
- Filter by status
- Search orders

### Payment Management
- Record payments
- View payment history
- Link payments to orders
- Multiple payment methods support

## Usage

### Login
1. Navigate to `/admin/login.html`
2. Enter admin/operator credentials
3. Default admin: +9779800000000 / admin123

### Dashboard
- Auto-refreshes key metrics
- Shows recent activity
- Highlights overdue accounts

### Approving Retailers
1. Go to Retailers tab
2. Find pending retailer
3. Click "Approve"
4. Set credit limit
5. Confirm

### Creating Orders
1. Go to Orders tab
2. Click "Create Order"
3. Select retailer and vendor
4. Add products and quantities
5. Add notes (optional)
6. Submit

### Recording Payments
1. Go to Payments tab
2. Click "Record Payment"
3. Select order
4. Enter amount (max = due amount)
5. Select payment method
6. Add reference number
7. Submit

## Technical Details

### API Integration
- Uses JWT authentication
- Token stored in localStorage
- Auto-logout on token expiry
- All API calls to `/api/v1/*`

### Performance
- Minimal CSS (no frameworks)
- Vanilla JavaScript (no dependencies)
- Fast page loads
- Efficient DOM updates

### Browser Support
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Development

### File Structure
```
public/admin/
├── index.html      # Main admin interface
├── login.html      # Login page
├── style.css       # Minimal styling
├── app.js          # Application logic
└── README.md       # This file
```

### Customization
- Edit `style.css` for styling changes
- Modify `app.js` for functionality
- Update `index.html` for layout changes

### Adding Features
1. Add HTML in `index.html`
2. Add styles in `style.css`
3. Add logic in `app.js`
4. Create API endpoint if needed
5. Test thoroughly

## Security

- JWT token authentication
- Role-based access (Admin/Operator only)
- Auto-logout on unauthorized
- HTTPS recommended for production
- No sensitive data in localStorage except token

## Troubleshooting

### Can't Login
- Check credentials
- Verify user role is ADMIN or OPERATOR
- Check API is running
- Check browser console for errors

### Data Not Loading
- Check network tab for API errors
- Verify token is valid
- Check API endpoint responses
- Refresh page

### Modal Not Closing
- Click outside modal
- Press ESC key
- Refresh page if stuck

## Future Enhancements
- Real-time updates with WebSocket
- Export data to CSV/Excel
- Advanced filtering and sorting
- Bulk operations
- Mobile responsive improvements
- Dark mode
