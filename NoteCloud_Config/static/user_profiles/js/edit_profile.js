const textarea = document.getElementById('id_about_me');

textarea.addEventListener('focus', () => {
    if (textarea.value === '') {
        textarea.value = '';
    }
});

textarea.addEventListener('blur', () => {
    if (textarea.value === '') {
        textarea.value = '';
    }
});


let croppedBlob = null;

document.getElementById('id_avatar').addEventListener('change', function(event) {
    const files = event.target.files;
    if (files.length > 0) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const image = document.getElementById('image-to-crop');
            image.src = e.target.result;
            document.getElementById('crop-modal').style.display = 'block';


            const cropper = new Cropper(image, {
                aspectRatio: 1,
                viewMode: 1,
            });

            document.getElementById('confirm-crop').onclick = function() {
                const canvas = cropper.getCroppedCanvas({
                    width: 256,
                    height: 256,
                });
                canvas.toBlob(function(blob) {
                    croppedBlob = blob;
                    document.getElementById('crop-modal').style.display = 'none';
                });
            };
        };
        reader.readAsDataURL(files[0]);
    }
});

document.getElementById('profile-form').addEventListener('submit', function(event) {
    if (event.submitter && event.submitter.name === 'delete_avatar') {
        return;
    }
    event.preventDefault();

    const formData = new FormData(this);
    if (croppedBlob) {
        formData.append('avatar', croppedBlob, 'cropped-avatar.png');
    }

    fetch(this.action, {
        method: 'POST',
        body: formData,
        headers: {
            'X-CSRFToken': '{{ csrf_token }}'
        }
    }).then(response => {
        if (response.ok) {
            location.reload();
        } else {
            alert('Ошибка при сохранении!');
        }
    });
});
