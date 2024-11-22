// avatarCropper.js
import { CONSTANTS, utils } from './config.js';

export class AvatarCropper {
    constructor() {
        this.cropper = null;
        this.croppedBlob = null;
        this.elements = {
            container: document.getElementById('cropper-container'),
            image: document.getElementById('cropper-image'),
            preview: document.getElementById('avatar-preview'),
            input: document.getElementById('avatar-input'),
            dropZone: document.getElementById('avatar-container'),
            chooseBtn: document.getElementById('choose-avatar'),
            editBtn: document.getElementById('edit-avatar'),
            controls: {
                rotateLeft: document.getElementById('rotate-left'),
                rotateRight: document.getElementById('rotate-right'),
                zoomIn: document.getElementById('zoom-in'),
                zoomOut: document.getElementById('zoom-out'),
                cancel: document.getElementById('cancel-crop'),
                confirm: document.getElementById('confirm-crop'),
                helpText: document.getElementById('avatar-help'),
                errorText: document.getElementById('avatar-error'),
                formatText: document.getElementById('avatar-format')
            }
        };

        this.cropperOptions = {
            viewMode: 2,
            dragMode: 'move',
            aspectRatio: 1,
            autoCropArea: 0.8,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: false,
            toggleDragModeOnDblclick: false,
            minContainerWidth: 600,
            minContainerHeight: 600,
            minCropBoxWidth: 600,
            minCropBoxHeight: 600,
            rotatable: true,
            scalable: true,
            zoomable: true,
            zoomOnTouch: true,
            zoomOnWheel: true,
            wheelZoomRatio: 0.1,
            ready: (e) => {
                const cropper = e.currentTarget.cropper;
                cropper.setCropBoxData({
                    width: 200,
                    height: 200,
                    left: (cropper.getContainerData().width - 200) / 2,
                    top: (cropper.getContainerData().height - 200) / 2
                });
            },
            cropstart: (e) => {
                if (e.detail.action === 'crop') {
                    e.preventDefault();
                }
            },
            crop: utils.debounce(() => this.updatePreview(), 150)
        };

        this.init();
        this.showHelpText();
    }

    init() {
        this.bindEvents();
        this.setupDragAndDrop();
        this.setupKeyboardControls();
    }

    showHelpText() {
        if (this.elements.controls.helpText) {
            this.elements.controls.helpText.textContent = '点击或拖拽图片到此处，支持JPG、PNG、GIF格式，文件大小不超过5MB';
            this.elements.controls.formatText.innerHTML = `
                <ul>
                    <li>推荐使用正方形图片</li>
                    <li>支持旋转和缩放调整</li>
                    <li>可以拖拽图片调整位置</li>
                </ul>
            `;
        }
    }

    bindEvents() {
        this.elements.chooseBtn?.addEventListener('click', () => {
            this.elements.input?.click();
        });

        this.elements.editBtn?.addEventListener('click', () => {
            if (this.croppedBlob) {
                const url = URL.createObjectURL(this.croppedBlob);
                this.showCropper(url);
            }
        });

        this.elements.input?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                this.handleFileSelect(file);
            }
            e.target.value = '';
        });

        Object.entries(this.elements.controls).forEach(([action, element]) => {
            element?.addEventListener('click', () => {
                switch(action) {
                    case 'rotateLeft':
                        this.cropper?.rotate(-90);
                        break;
                    case 'rotateRight':
                        this.cropper?.rotate(90);
                        break;
                    case 'zoomIn':
                        this.cropper?.zoom(0.1);
                        break;
                    case 'zoomOut':
                        this.cropper?.zoom(-0.1);
                        break;
                    case 'cancel':
                        this.closeCropper();
                        break;
                    case 'confirm':
                        this.confirmCrop();
                        break;
                }
            });
        });
    }

    setupDragAndDrop() {
        if (!this.elements.dropZone) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.elements.dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        this.elements.dropZone.addEventListener('dragenter', () => {
            this.elements.dropZone.classList.add('drag-over');
        });

        this.elements.dropZone.addEventListener('dragleave', () => {
            this.elements.dropZone.classList.remove('drag-over');
        });

        this.elements.dropZone.addEventListener('drop', (e) => {
            this.elements.dropZone.classList.remove('drag-over');
            const file = e.dataTransfer?.files?.[0];
            if (file) {
                this.handleFileSelect(file);
            }
        });
    }

    setupKeyboardControls() {
        if (!this.elements.container) return;

        this.elements.container.addEventListener('keydown', (e) => {
            if (!this.cropper) return;

            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.cropper.rotate(-90);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.cropper.rotate(90);
                    break;
                case '+':
                case '=':
                    e.preventDefault();
                    this.cropper.zoom(0.1);
                    break;
                case '-':
                    e.preventDefault();
                    this.cropper.zoom(-0.1);
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.closeCropper();
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.confirmCrop();
                    break;
            }
        });
    }

    async handleFileSelect(file) {
        const validation = this.validateFile(file);
        if (!validation.valid) {
            this.showError(validation.error);
            return;
        }

        try {
            const compressedImage = await this.compressImage(file);
            const imageUrl = URL.createObjectURL(compressedImage);
            this.showCropper(imageUrl);
        } catch (error) {
            this.showError('文件处理失败：' + error.message);
        }
    }

    validateFile(file) {
        if (!file) return {
            valid: false,
            error: '请选择文件'
        };

        if (!CONSTANTS.FILE.ALLOWED_TYPES.includes(file.type)) {
            return {
                valid: false,
                error: '不支持该图片格式。请上传JPG、PNG或GIF格式的图片文件，建议使用JPG格式以获得最佳效果。'
            };
        }

        if (file.size > CONSTANTS.FILE.MAX_SIZE) {
            const maxSizeMB = CONSTANTS.FILE.MAX_SIZE / (1024 * 1024);
            return {
                valid: false,
                error: `文件过大。请上传小于${maxSizeMB}MB的图片，您可以压缩图片后重试。当前文件大小: ${(file.size / (1024 * 1024)).toFixed(1)}MB`
            };
        }

        return { valid: true };
    }

    async compressImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(objectUrl);

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let { width, height } = img;
                const maxSize = 1920;

                if (width > maxSize || height > maxSize) {
                    const ratio = maxSize / Math.max(width, height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => resolve(blob),
                    file.type,
                    CONSTANTS.FILE.IMAGE_QUALITY
                );
            };

            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = objectUrl;
        });
    }

    showCropper(imageUrl) {
        if (!this.elements.image || !this.elements.container) return;

        this.elements.image.src = imageUrl;
        this.elements.container.hidden = false;
        this.elements.container.focus();
        document.body.style.overflow = 'hidden';

        this.initCropper();
    }

    initCropper() {
        if (this.cropper) {
            this.cropper.destroy();
        }

        if (!this.elements.image) return;

        this.cropper = new Cropper(this.elements.image, this.cropperOptions);
    }

    updatePreview() {
        if (!this.cropper || !this.elements.preview) return;

        try {
            const canvas = this.cropper.getCroppedCanvas({
                width: CONSTANTS.FILE.OUTPUT_SIZE.width,
                height: CONSTANTS.FILE.OUTPUT_SIZE.height,
                fillColor: '#fff',
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
            });

            if (!canvas) {
                throw new Error('Failed to get cropped canvas');
            }

            if (this.croppedBlob) {
                URL.revokeObjectURL(URL.createObjectURL(this.croppedBlob));
            }

            return new Promise((resolve, reject) => {
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to create blob'));
                            return;
                        }
                        this.croppedBlob = blob;
                        const blobUrl = URL.createObjectURL(blob);
                        this.elements.preview.src = blobUrl;
                        resolve(blob);
                    },
                    'image/png',
                    CONSTANTS.FILE.IMAGE_QUALITY
                );
            });
        } catch (error) {
            console.error('Update preview error:', error);
            this.showError('更新预览图失败');
            return Promise.reject(error);
        }
    }

    closeCropper() {
        if (!this.elements.container) return;

        this.elements.container.hidden = true;
        document.body.style.overflow = '';

        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
    }

    showError(message) {
        utils.showError('avatar-error', message);
    }

    async confirmCrop() {
        try {
            await this.updatePreview();
            this.closeCropper();
            return this.croppedBlob;
        } catch (error) {
            console.error('Confirm crop error:', error);
            this.showError('确认裁剪失败');
            return null;
        }
    }

    getCroppedBlob() {
        return this.croppedBlob;
    }

    destroy() {
        this.closeCropper();
        if (this.elements.preview?.src) {
            URL.revokeObjectURL(this.elements.preview.src);
        }
        if (this.croppedBlob) {
            URL.revokeObjectURL(URL.createObjectURL(this.croppedBlob));
        }

        this.cropper = null;
        this.croppedBlob = null;
    }
}