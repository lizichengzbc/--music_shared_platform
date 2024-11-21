// imageProcessor.js
import { CONSTANTS, utils, HttpClient } from './config.js';

class ImageProcessor {
    constructor(options = {}) {
        this.options = {
            inputId: 'avatar-input',
            previewId: 'avatar-preview',
            containerId: 'cropper-container',
            cropperImageId: 'cropper-image',
            dropZoneId: 'avatar-container',
            controlIds: {
                choose: 'choose-avatar',
                edit: 'edit-avatar',
                rotateLeft: 'rotate-left',
                rotateRight: 'rotate-right',
                zoomIn: 'zoom-in',
                zoomOut: 'zoom-out',
                cancel: 'cancel-crop',
                confirm: 'confirm-crop'
            },
            cropperOptions: {
                viewMode: 2,
                dragMode: 'move',
                aspectRatio: 1,
                autoCropArea: 0.8,
                background: false,
                responsive: true,
                guides: true,
                cropBoxMovable: true,
                cropBoxResizable: false,
                toggleDragModeOnDblclick: false,
                minContainerWidth: 400,
                minContainerHeight: 400,
                rotatable: true,
                scalable: true,
                zoomable: true,
                zoomOnTouch: true,
                zoomOnWheel: true,
                wheelZoomRatio: 0.1,
                ready: function() {
                    this.cropper.setCropBoxData({
                        width: CONSTANTS.FILE.OUTPUT_SIZE.width,
                        height: CONSTANTS.FILE.OUTPUT_SIZE.height
                    });
                }
            },
            ...options
        };

        this.cropper = null;
        this.croppedImageBlob = null;
        this.eventManager = new EventManager();
        this.urlCache = new Set();

        this.init();
    }

    init() {
        this.bindEvents();
        this.setupDragAndDrop();
        this.setupKeyboardControls();
    }

    bindEvents() {
        const { controlIds } = this.options;

        // 选择图片按钮
        this.eventManager.on(
            utils.getElement(controlIds.choose),
            'click',
            () => utils.getElement(this.options.inputId)?.click()
        );

        // 编辑图片按钮
        this.eventManager.on(
            utils.getElement(controlIds.edit),
            'click',
            () => {
                if (this.croppedImageBlob) {
                    this.showCropper(utils.createSafeUrl(this.croppedImageBlob));
                }
            }
        );

        // 文件选择处理
        this.eventManager.on(
            utils.getElement(this.options.inputId),
            'change',
            (e) => {
                const file = e.target.files?.[0];
                if (file) {
                    this.handleFileSelect(file);
                }
                e.target.value = '';
            }
        );

        this.bindCropperControls();
    }

    setupDragAndDrop() {
        const dropZone = utils.getElement(this.options.dropZoneId);
        if (!dropZone) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.eventManager.on(dropZone, eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // 拖拽状态处理
        this.eventManager.on(dropZone, 'dragenter',
            () => dropZone.classList.add('drag-over')
        );

        this.eventManager.on(dropZone, 'dragleave',
            () => dropZone.classList.remove('drag-over')
        );

        // 文件放置处理
        this.eventManager.on(dropZone, 'drop', (e) => {
            dropZone.classList.remove('drag-over');
            const file = e.dataTransfer?.files?.[0];
            if (file) {
                this.handleFileSelect(file);
            }
        });
    }

    setupKeyboardControls() {
        const container = utils.getElement(this.options.containerId);
        if (!container) return;

        this.eventManager.on(container, 'keydown', (e) => {
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
            const imageUrl = utils.createSafeUrl(compressedImage);
            this.showCropper(imageUrl);
        } catch (error) {
            this.showError('文件处理失败：' + error.message);
        }
    }

    validateFile(file) {
        if (!file) return { valid: false, error: '请选择文件' };

        if (!CONSTANTS.FILE.ALLOWED_TYPES.includes(file.type)) {
            return { valid: false, error: '请选择有效的图片文件 (JPG, PNG, GIF)' };
        }

        if (file.size > CONSTANTS.FILE.MAX_SIZE) {
            return { valid: false, error: '文件大小不能超过 5MB' };
        }

        return { valid: true };
    }



    showCropper(imageUrl) {
        const cropperImage = utils.getElement(this.options.cropperImageId);
        if (!cropperImage) return;

        cropperImage.src = imageUrl;
        const container = utils.getElement(this.options.containerId);
        if (container) {
            container.style.display = 'block';
            document.body.style.overflow = 'hidden';
            container.focus();
        }

        this.initCropper();
    }

    initCropper() {
        if (this.cropper) {
            this.cropper.destroy();
        }

        const cropperImage = utils.getElement(this.options.cropperImageId);
        if (!cropperImage) return;

        this.addCircularCropStyle();
        this.cropper = new Cropper(cropperImage, {
            ...this.options.cropperOptions,
            crop: utils.debounce(() => this.updatePreview(), 150)
        });
    }

    addCircularCropStyle() {
        const cropperContainer = document.querySelector('.cropper-container');
        if (cropperContainer) {
            cropperContainer.style.width = '100%';
            cropperContainer.style.height = '100%';
        }

        ['cropper-view-box', 'cropper-face'].forEach(className => {
            const element = document.querySelector(`.${className}`);
            if (element) {
                element.style.borderRadius = '50%';
                element.style.overflow = 'hidden';
            }
        });
    }

    bindCropperControls() {
        const { controlIds } = this.options;

        // 旋转控制
        const rotateHandlers = {
            [controlIds.rotateLeft]: -90,
            [controlIds.rotateRight]: 90
        };

        Object.entries(rotateHandlers).forEach(([id, angle]) => {
            this.eventManager.on(
                utils.getElement(id),
                'click',
                () => this.cropper?.rotate(angle)
            );
        });

        // 缩放控制
        const zoomHandlers = {
            [controlIds.zoomIn]: 0.1,
            [controlIds.zoomOut]: -0.1
        };

        Object.entries(zoomHandlers).forEach(([id, delta]) => {
            this.eventManager.on(
                utils.getElement(id),
                'click',
                () => this.cropper?.zoom(delta)
            );
        });

        // 确认和取消按钮
        this.eventManager.on(
            utils.getElement(controlIds.cancel),
            'click',
            () => this.closeCropper()
        );

        this.eventManager.on(
            utils.getElement(controlIds.confirm),
            'click',
            () => this.confirmCrop()
        );
    }

    updatePreview() {
        if (!this.cropper) return;

        const previewElement = utils.getElement(this.options.previewId);
        if (!previewElement) return;

        requestAnimationFrame(() => {
            this.cropper.getCroppedCanvas({
                width: CONSTANTS.FILE.OUTPUT_SIZE.width,
                height: CONSTANTS.FILE.OUTPUT_SIZE.height,
                fillColor: '#fff',
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
            }).toBlob(
                (blob) => {
                    if (this.croppedImageBlob) {
                        URL.revokeObjectURL(previewElement.src);
                    }
                    this.croppedImageBlob = blob;
                    previewElement.src = utils.createSafeUrl(blob);
                },
                'image/png',
                CONSTANTS.FILE.IMAGE_QUALITY
            );
        });
    }

    closeCropper() {
        const container = utils.getElement(this.options.containerId);
        if (container) {
            container.style.display = 'none';
            document.body.style.overflow = '';
        }

        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
    }

    confirmCrop() {
        this.updatePreview();
        this.closeCropper();
    }

    showError(message) {
        const errorElement = utils.getElement('avatar-error');
        if (errorElement) {
            errorElement.textContent = utils.escapeHtml(message);
            errorElement.style.display = 'block';
            errorElement.setAttribute('role', 'alert');
        }
    }

    getCroppedBlob() {
        return this.croppedImageBlob;
    }

    destroy() {
        this.closeCropper();
        this.urlCache.forEach(url => URL.revokeObjectURL(url));
        this.urlCache.clear();
        this.eventManager.destroy();
    }
}

export default ImageProcessor;