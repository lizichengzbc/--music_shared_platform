document.addEventListener('DOMContentLoaded', function() {
    const userAvatar = document.querySelector('.user-avatar');
    const dropdownMenu = document.querySelector('.dropdown-menu');

    // 点击头像切换下拉菜单显示状态
    userAvatar.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    // 点击页面其他地方关闭下拉菜单
    document.addEventListener('click', function(e) {
        if (!dropdownMenu.contains(e.target) && e.target !== userAvatar) {
            dropdownMenu.style.display = 'none';
        }
    });
});
