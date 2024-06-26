// Open IndexedDB database
const openDB = () => {
	// 打开或者创建一个名为cardDB的数据库，版本号为1
	return new Promise((resolve, reject) => {
		const request = window.indexedDB.open('cardDB', 1);
		// 打开数据库失败
		request.onerror = (event) => {
			console.error('Database error:', event.target.errorCode);
			reject(event.target.errorCode);
		};
		// 打开数据库成功
		request.onsuccess = (event) => {
			const db = event.target.result;
			resolve(db);
		};
		// 数据库升级
		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			const objectStore = db.createObjectStore('cards', { keyPath: 'id' });
		};
	});
};

new Vue({
	el: '#app',
	data: {
		currentCard: null, // 初始化为null，用于存储当前植物卡片
		cards: [],
		selectedFileName: '',  // 在数据中添加一个用来存储文件名的属性
		isModalOpen: false,
		modalMode: '', // 可以是 'edit' 或 'details'
		isNewCard: false, // 标记是否为新建卡片
		inputTemperature: 20,  // 用户输入的临时温度值
		currentTemperature: 20,  // 确认后的当前温度值
	},

	mounted() {
		this.$nextTick(() => {
			// 此处确保DOM已经渲染完毕
			const fileInput = document.querySelector("#file-name input[type=file]");
			if (fileInput) {
				fileInput.onchange = () => {
					if (fileInput.files.length > 0) {
						const fileName = document.querySelector("#file-name .file-name");
						fileName.textContent = fileInput.files[0].name;
					}
				};
			} else {
				console.error('File input element not found!');
			}
		});
	},

	created() {
		// 打开数据库并获取所有数据
		openDB().then(db => {
			this.db = db;
			this.getCards();
		});
	},
	methods: {
		openModal(card, mode) {
			this.currentCard = card;
			this.modalMode = mode; // 'edit' 或 'details'
			this.isModalOpen = true;
		},
		closeModal() {
			this.isModalOpen = false;
			this.currentCard = null;
		},
		handleBackgroundClick() {
			this.closeModal(); // 调用关闭模态的方法
		},
		getCards() {
			// 读取所有数据
			const transaction = this.db.transaction(['cards'], 'readonly');
			const objectStore = transaction.objectStore('cards');
			const request = objectStore.getAll();
			request.onsuccess = () => {
				// 反转卡片数组
				this.cards = request.result.map(card => ({ ...card, editing: false })).reverse();
			};
		},
		editCard(card) {
			if (!card) {
				console.error('Invalid card data!');
				return; // 防止进一步处理无效的卡片数据
			}
			this.currentCard = card;
			this.isModalOpen = true;
		},

		saveCard(card) {
			const transaction = this.db.transaction(['cards'], 'readwrite');
			const objectStore = transaction.objectStore('cards');
			const request = objectStore.put(card);
			request.onsuccess = () => {
				console.log('Card saved successfully');
				this.modalMode = 'details'; // 切换到详情视图
				// 如果你不想保持模态窗口打开，可以直接关闭它
				// this.closeModal();
			};
			request.onerror = () => {
				console.error('Error saving the card');
			};
		},
		createNewCard() {
			const newCard = {
				id: Date.now().toString(),
				title: '',
				subtitle: '',
				description: '',
				wateringInterval: 7,
				lastWatered: '',
				image: '',
				sunlight: '',
				temperatureMin: '15',  // 默认最低温度
				temperatureMax: '25'   // 默认最高温度
			};
			this.cards.unshift(newCard); // 将新卡片添加到列表的开始
			this.openModal(newCard, 'edit');
			this.isNewCard = true;
		},
		cancelEdit(card) {
			if (confirm("确定要取消编辑，并放弃所有未保存的更改吗？")) {
				// 用户确认取消编辑
				this.modalMode = 'details'; // 切换回详情视图

				// 重新加载卡片数据
				this.loadCard(card.id); // 假设 loadCard 方法会从数据库重新加载数据
			}
		},
		loadCard(cardId) {
			const transaction = this.db.transaction(['cards'], 'readonly');
			const objectStore = transaction.objectStore('cards');
			const request = objectStore.get(cardId);
			request.onsuccess = () => {
				this.currentCard = request.result;
			};
			request.onerror = () => {
				console.error('Failed to reload the card');
			};
		},
		deleteCard(card) {
			if (confirm("确定要删除这个植物卡片吗？")) {  // 弹出确认对话框
				const transaction = this.db.transaction(['cards'], 'readwrite');
				const objectStore = transaction.objectStore('cards');
				const request = objectStore.delete(card.id);
				request.onsuccess = () => {
					console.log('Card deleted successfully');
					this.cards = this.cards.filter(c => c.id !== card.id); // 更新卡片列表，移除已删除的卡片
					this.closeModal(); // 删除成功后关闭模态窗口
				};
				request.onerror = () => {
					console.error('Failed to delete the card');
				};
			}
		},
		closeModal() {
			this.isModalOpen = false;
			this.currentCard = null; // 清除当前卡片数据
		},

		handleFileUpload(event, card) {
			const file = event.target.files[0];
			if (file) {
				// 更新选中的文件名
				this.selectedFileName = file.name;

				// 创建一个FileReader来读取文件
				const reader = new FileReader();
				reader.onload = (e) => {
					// 文件读取完毕后，将结果赋值给卡片的图片属性，用于显示
					card.image = e.target.result;
				};
				// 以DataURL的形式读取文件内容
				reader.readAsDataURL(file);

				// 更新最后浇水日期为今天，假设文件上传的同时也是植物的维护日期
				card.lastWatered = new Date().toISOString().split('T')[0];

				// 如果有需要，这里可以调用保存或更新植物信息的函数
				// this.saveCard(card);
			} else {
				// 如果没有选择文件，清除之前的文件名显示
				this.selectedFileName = '';
			}
		},
		calculateProgress(card) {
			const today = new Date();
			const lastWateredDate = new Date(card.lastWatered);

			// 计算自上次浇水以来的天数，向下取整以确保不会有小数天数
			const daysSinceLastWatered = Math.floor((today - lastWateredDate) / (1000 * 60 * 60 * 24));

			// 如果上次浇水日期在未来，则进度为 0
			if (daysSinceLastWatered < 0) {
				return 0;
			}

			// 如果上次浇水日期是今天，则进度为 100
			if (daysSinceLastWatered === 0) {
				return 100;
			}

			// 如果上次浇水日期在过去，计算剩余天数
			const interval = card.wateringInterval;
			let progress = 100 - ((daysSinceLastWatered / interval) * 100);

			// 确保进度在 0 到 100 之间
			progress = Math.min(100, Math.max(0, progress));
			return progress;
		},

		waterCard(card) {
			card.lastWatered = new Date().toISOString().split('T')[0];
			this.saveCard(card);
		},
		triggerFileInput() {
			document.getElementById('fileInput').click(); // 触发隐藏的文件输入点击事件
		},
		exportData() {
			const transaction = this.db.transaction(['cards'], 'readonly');
			const objectStore = transaction.objectStore('cards');
			const request = objectStore.getAll();

			request.onsuccess = () => {
				const jsonData = JSON.stringify(request.result);
				const blob = new Blob([jsonData], { type: 'application/json' });

				// 生成包含当前日期的文件名
				const date = new Date();
				const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, '');  // 格式为 YYYYMMDD
				const filename = `PlantMemo_data_${formattedDate}.json`;

				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = filename;
				a.click();
				URL.revokeObjectURL(url);
				console.log('数据导出成功');
			};
		},
		importData(event) {
			const file = event.target.files[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = (e) => {
					const cards = JSON.parse(e.target.result);
					const transaction = this.db.transaction(['cards'], 'readwrite');
					const objectStore = transaction.objectStore('cards');
					cards.forEach(card => {
						objectStore.put(card);
					});
					transaction.oncomplete = () => {
						console.log('所有数据已成功导入');
						this.getCards(); // 重新加载卡片以更新视图
					};
				};
				reader.readAsText(file);
			}
		},
		getTemperatureClass(temperature) {
			if (temperature <= 0) {
				return 'has-text-info';
			} else if (temperature > 0 && temperature < 25) {
				return 'has-text-warning';
			} else {
				return 'has-text-danger';
			}
		},
		compareTemperature(temperatureMin, temperatureMax) {
			// 确保温度值是数字
			const currentTemp = parseInt(this.currentTemperature);
			const minTemp = parseInt(temperatureMin);
			const maxTemp = parseInt(temperatureMax);

			if (currentTemp < minTemp) {
				return '低于适宜温度';
			} else if (currentTemp > maxTemp) {
				return '高于适宜温度';
			} else {
				return '处在适宜温度区间';
			}
		},
		confirmTemperature() {
			// 将输入温度转换为整数并更新当前温度
			this.currentTemperature = parseInt(this.inputTemperature);
		},
		getTemperatureTagContent(card) {
			if (this.currentTemperature < card.temperatureMin) {
				return '低温';
			} else if (this.currentTemperature > card.temperatureMax) {
				return '高温';
			}
			return '';
		},
	}
});


// 检索所选文件名
const fileInput = document.querySelector("#file-name input[type=file]");