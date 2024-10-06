  {{ 'custom-mw.css' | asset_url | stylesheet_tag: preload: true }}


$('cart-drawer').load(location.href + "#CartDrawer");

// Load the cart drawer from the current page
  $('.cart-drawer').load(location.href + ' .cart-drawer > *', function(response, status, xhr) {
      if (status == "error") {
          // Handle error
          $('.cart-drawer').html('<p>Error loading cart. Please try again.</p>');
          console.error("Error loading cart:", xhr.status, xhr.statusText);
      } else {
          // Only show the drawer if it has items
          const itemCount = $('.cart-items').children().length;
          if (itemCount > 0) {
              $('.cart-drawer').show(); // Show the drawer if there are items
          } else {
              $('.cart-drawer').hide(); // Hide the drawer if empty
          }
      }
  });
