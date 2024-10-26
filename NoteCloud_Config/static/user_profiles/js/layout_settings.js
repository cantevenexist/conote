document.addEventListener('DOMContentLoaded', function() {
            const items = document.querySelectorAll('.settings-item');
            items.forEach(item => {
                item.addEventListener('click', function() {
                    const url = this.getAttribute('data-url');
                    fetch(url)
                        .then(response => response.text())
                        .then(data => {
                            document.getElementById('settings-content').innerHTML = data;
                        })
                        .catch(error => console.error('Error:', error));
                });
            });
});


