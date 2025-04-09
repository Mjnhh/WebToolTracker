// Dữ liệu câu hỏi cho quiz
const quizQuestions = [
    {
        question: "Ngôn ngữ lập trình nào thường được sử dụng cho phát triển web phía client?",
        options: ["Java", "Python", "JavaScript", "C++"],
        correctAnswer: 2, // Index 2 = JavaScript
        explanation: "JavaScript là ngôn ngữ lập trình phổ biến nhất cho phát triển web phía client, cho phép tạo các trang web tương tác."
    },
    {
        question: "Viết tắt HTML có nghĩa là gì?",
        options: ["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Language", "Hyperlink Text Management Language"],
        correctAnswer: 0,
        explanation: "HTML viết tắt của Hyper Text Markup Language, là ngôn ngữ đánh dấu tiêu chuẩn để tạo các trang web."
    },
    {
        question: "Đâu là công nghệ phát triển mạng xã hội lớn nhất thế giới - Facebook?",
        options: ["Angular", "React", "Vue.js", "Svelte"],
        correctAnswer: 1,
        explanation: "React là thư viện JavaScript được phát triển bởi Facebook để xây dựng giao diện người dùng, và được sử dụng chính trong mạng xã hội Facebook."
    },
    {
        question: "Hệ quản trị cơ sở dữ liệu nào KHÔNG phải là loại SQL?",
        options: ["MySQL", "PostgreSQL", "MongoDB", "Oracle"],
        correctAnswer: 2,
        explanation: "MongoDB là hệ quản trị cơ sở dữ liệu NoSQL, khác với MySQL, PostgreSQL và Oracle là các hệ quản trị cơ sở dữ liệu SQL."
    },
    {
        question: "Trí tuệ nhân tạo sinh thành (Generative AI) như ChatGPT sử dụng loại mô hình nào?",
        options: ["Convolutional Neural Network", "Recurrent Neural Network", "Transformer", "Random Forest"],
        correctAnswer: 2,
        explanation: "ChatGPT và các mô hình ngôn ngữ lớn khác sử dụng kiến trúc Transformer, được giới thiệu trong bài báo 'Attention is All You Need'."
    },
    {
        question: "Khái niệm 'Responsive Design' trong phát triển web đề cập đến điều gì?",
        options: ["Thiết kế trang web thân thiện với môi trường", "Thiết kế trang web tải nhanh", "Thiết kế trang web thích ứng với các kích thước màn hình khác nhau", "Thiết kế trang web với thời gian phản hồi nhanh"],
        correctAnswer: 2,
        explanation: "Responsive Design là phương pháp thiết kế website sao cho giao diện thích ứng với các kích thước màn hình khác nhau, từ desktop đến mobile."
    },
    {
        question: "API là viết tắt của?",
        options: ["Application Programming Interface", "Automated Program Integration", "Advanced Programming Innovation", "Application Process Integration"],
        correctAnswer: 0,
        explanation: "API là viết tắt của Application Programming Interface, cho phép các ứng dụng phần mềm khác nhau giao tiếp với nhau."
    },
    {
        question: "Đâu là công cụ quản lý phiên bản mã nguồn phổ biến nhất hiện nay?",
        options: ["Subversion (SVN)", "Mercurial", "Git", "CVS"],
        correctAnswer: 2,
        explanation: "Git là hệ thống quản lý phiên bản phân tán phổ biến nhất hiện nay, được phát triển bởi Linus Torvalds để phát triển nhân Linux."
    },
    {
        question: "Kiến trúc microservices là gì?",
        options: ["Kiến trúc ứng dụng nhỏ gọn", "Kiến trúc chia nhỏ ứng dụng thành các dịch vụ nhỏ, độc lập", "Kiến trúc không sử dụng server", "Kiến trúc chỉ sử dụng các service nhỏ hơn 1MB"],
        correctAnswer: 1,
        explanation: "Kiến trúc microservices là một kiểu kiến trúc phần mềm chia ứng dụng thành nhiều dịch vụ nhỏ, độc lập và có thể triển khai riêng biệt."
    },
    {
        question: "Sử dụng kỹ thuật nào để tối ưu hóa quá trình tải trang web?",
        options: ["Code minification", "Database optimization", "Server-side rendering", "Tất cả các phương án trên"],
        correctAnswer: 3,
        explanation: "Tất cả các kỹ thuật trên đều giúp tối ưu hóa quá trình tải trang web. Code minification giảm kích thước file, database optimization cải thiện truy vấn, và server-side rendering cải thiện thời gian hiển thị nội dung."
    }
];

// Các biến toàn cục
let currentQuestion = 0;
let score = 0;
let userAnswers = [];
let timerInterval;
let timeLeft = 5 * 60; // 5 phút in seconds

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    // Buttons
    const startBtn = document.getElementById('start-quiz');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const submitBtn = document.getElementById('submit-btn');
    const viewAnswersBtn = document.getElementById('view-answers');
    const viewAnswersFailureBtn = document.getElementById('view-answers-failure');
    const retryQuizBtn = document.getElementById('retry-quiz');
    const backToResultsBtn = document.getElementById('back-to-results');
    const shareResultsBtn = document.getElementById('share-results');
    const copyVoucherBtn = document.getElementById('copy-voucher');
    
    // Screens
    const welcomeScreen = document.getElementById('quiz-welcome');
    const questionsScreen = document.getElementById('quiz-questions');
    const resultsScreen = document.getElementById('quiz-results');
    const reviewScreen = document.getElementById('quiz-review');
    
    // Results sections
    const successResults = document.getElementById('results-success');
    const failureResults = document.getElementById('results-failure');
    
    // Question elements
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.querySelector('.options-container');
    const currentQuestionSpan = document.getElementById('current-question');
    const totalQuestionsSpan = document.getElementById('total-questions');
    const progressFill = document.querySelector('.progress-fill');
    const timerSpan = document.getElementById('timer');
    
    // Results elements
    const finalScoreSpan = document.getElementById('final-score');
    const finalScoreFailureSpan = document.getElementById('final-score-failure');
    const voucherCodeSpan = document.getElementById('voucher-code');
    const reviewContainer = document.querySelector('.review-container');
    
    // Initialize
    init();
    
    // Event Listeners
    startBtn.addEventListener('click', startQuiz);
    nextBtn.addEventListener('click', nextQuestion);
    prevBtn.addEventListener('click', prevQuestion);
    submitBtn.addEventListener('click', submitQuiz);
    viewAnswersBtn.addEventListener('click', showReview);
    viewAnswersFailureBtn.addEventListener('click', showReview);
    retryQuizBtn.addEventListener('click', retryQuiz);
    backToResultsBtn.addEventListener('click', backToResults);
    shareResultsBtn.addEventListener('click', shareResults);
    copyVoucherBtn.addEventListener('click', copyVoucherCode);
    
    // Functions
    function init() {
        // Set total questions count
        totalQuestionsSpan.textContent = quizQuestions.length;
        
        // Initialize user answers array with nulls
        userAnswers = Array(quizQuestions.length).fill(null);
    }
    
    function startQuiz() {
        // Switch screens
        welcomeScreen.classList.remove('active');
        questionsScreen.classList.add('active');
        
        // Initialize timer
        startTimer();
        
        // Load first question
        loadQuestion(0);
    }
    
    function loadQuestion(index) {
        // Update current question number
        currentQuestion = index;
        currentQuestionSpan.textContent = index + 1;
        
        // Update progress bar
        const progressPercentage = ((index + 1) / quizQuestions.length) * 100;
        progressFill.style.width = `${progressPercentage}%`;
        
        // Enable/disable prev button based on question index
        prevBtn.disabled = index === 0;
        
        // Show/hide next and submit buttons
        if (index === quizQuestions.length - 1) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'block';
        } else {
            nextBtn.style.display = 'block';
            submitBtn.style.display = 'none';
        }
        
        // Load question content
        const question = quizQuestions[index];
        questionText.textContent = question.question;
        
        // Clear previous options
        optionsContainer.innerHTML = '';
        
        // Create new option elements
        question.options.forEach((option, optIndex) => {
            const optionItem = document.createElement('div');
            optionItem.className = 'option-item';
            
            // If this question has been answered, highlight the selected option
            if (userAnswers[index] === optIndex) {
                optionItem.classList.add('selected');
            }
            
            optionItem.innerHTML = `
                <div class="option-marker">${String.fromCharCode(65 + optIndex)}</div>
                <div class="option-text">${option}</div>
            `;
            
            optionItem.addEventListener('click', () => selectOption(optIndex));
            optionsContainer.appendChild(optionItem);
        });
    }
    
    function selectOption(optionIndex) {
        // Save user's answer
        userAnswers[currentQuestion] = optionIndex;
        
        // Update UI to show selected option
        const options = optionsContainer.querySelectorAll('.option-item');
        
        options.forEach((option, index) => {
            if (index === optionIndex) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });
    }
    
    function nextQuestion() {
        if (currentQuestion < quizQuestions.length - 1) {
            loadQuestion(currentQuestion + 1);
        }
    }
    
    function prevQuestion() {
        if (currentQuestion > 0) {
            loadQuestion(currentQuestion - 1);
        }
    }
    
    function submitQuiz() {
        // Stop timer
        clearInterval(timerInterval);
        
        // Calculate score
        calculateScore();
        
        // Switch to results screen
        questionsScreen.classList.remove('active');
        resultsScreen.classList.add('active');
        
        // Generate random voucher code
        generateVoucherCode();
        
        // Show appropriate results section based on score
        if (score >= 7) { // 70% correct to pass
            successResults.style.display = 'block';
            failureResults.style.display = 'none';
            finalScoreSpan.textContent = score;
            // Apply pulse animation to voucher
            document.querySelector('.voucher-code').classList.add('pulse-animation');
            
            // Create confetti celebration effect
            createConfetti();
        } else {
            successResults.style.display = 'none';
            failureResults.style.display = 'block';
            finalScoreFailureSpan.textContent = score;
        }
    }
    
    function calculateScore() {
        score = 0;
        userAnswers.forEach((answer, index) => {
            if (answer === quizQuestions[index].correctAnswer) {
                score++;
            }
        });
    }
    
    function showReview() {
        // Switch to review screen
        resultsScreen.classList.remove('active');
        reviewScreen.classList.add('active');
        
        // Clear previous review
        reviewContainer.innerHTML = '';
        
        // Create review items for each question
        quizQuestions.forEach((question, index) => {
            const userAnswer = userAnswers[index];
            const isCorrect = userAnswer === question.correctAnswer;
            
            const reviewItem = document.createElement('div');
            reviewItem.className = `review-item ${isCorrect ? 'correct' : 'incorrect'}`;
            
            // Create question header
            const questionHeader = document.createElement('div');
            questionHeader.className = 'review-question';
            questionHeader.textContent = `${index + 1}. ${question.question}`;
            
            // Create answers container
            const answersContainer = document.createElement('div');
            answersContainer.className = 'review-answers';
            
            // Add each answer with appropriate icons
            question.options.forEach((option, optIndex) => {
                const answerItem = document.createElement('div');
                answerItem.className = 'review-answer';
                
                let icon = 'fa-circle';
                let iconClass = 'far';
                
                if (optIndex === question.correctAnswer) {
                    icon = 'fa-check-circle';
                    iconClass = 'fas';
                } else if (optIndex === userAnswer) {
                    icon = 'fa-times-circle';
                    iconClass = 'fas';
                }
                
                answerItem.innerHTML = `
                    <i class="${iconClass} ${icon}"></i>
                    <div class="review-answer-text">${option}</div>
                `;
                
                answersContainer.appendChild(answerItem);
            });
            
            // Add explanation
            const explanationDiv = document.createElement('div');
            explanationDiv.className = 'review-explanation';
            explanationDiv.textContent = question.explanation;
            
            // Append all elements to review item
            reviewItem.appendChild(questionHeader);
            reviewItem.appendChild(answersContainer);
            reviewItem.appendChild(explanationDiv);
            
            // Add review item to container
            reviewContainer.appendChild(reviewItem);
        });
    }
    
    function backToResults() {
        // Switch back to results screen
        reviewScreen.classList.remove('active');
        resultsScreen.classList.add('active');
    }
    
    function retryQuiz() {
        // Reset quiz state
        currentQuestion = 0;
        score = 0;
        userAnswers = Array(quizQuestions.length).fill(null);
        timeLeft = 5 * 60;
        
        // Switch back to welcome screen
        resultsScreen.classList.remove('active');
        welcomeScreen.classList.add('active');
    }
    
    function startTimer() {
        updateTimerDisplay();
        
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                submitQuiz();
            }
        }, 1000);
    }
    
    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerSpan.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        
        // Add warning color when time is running low
        if (timeLeft < 60) {
            timerSpan.style.color = '#e74c3c';
        }
    }
    
    function generateVoucherCode() {
        // Generate a random voucher code
        const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let voucherCode = 'TECH';
        
        for (let i = 0; i < 6; i++) {
            voucherCode += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        
        voucherCodeSpan.textContent = voucherCode;
        
        // Lưu voucher lên server
        saveVoucherToServer(voucherCode, score);
    }
    
    function saveVoucherToServer(code, quizScore) {
        // Tạo object chứa thông tin voucher
        const voucherData = {
            code: code,
            discountPercent: 25, // Sửa thành discountPercent thay vì discount 
            quizScore: quizScore
        };
        
        // Gửi lên server
        fetch('/api/vouchers/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(voucherData)
        })
        .then(response => {
            if (!response.ok) {
                console.error('Lỗi khi lưu voucher:', response.statusText);
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Voucher đã được lưu:', data);
            // Hiển thị thông báo thành công nếu cần
            const voucherMessage = document.querySelector('.voucher-message');
            if (voucherMessage) {
                voucherMessage.textContent = "Mã giảm giá đã được tạo và lưu thành công!";
                voucherMessage.style.color = "#27ae60";
            }
        })
        .catch(error => {
            console.error('Lỗi khi lưu voucher:', error);
            // Hiển thị thông báo lỗi nếu cần
            const voucherMessage = document.querySelector('.voucher-message');
            if (voucherMessage) {
                voucherMessage.textContent = "Có lỗi khi tạo mã giảm giá. Vui lòng thử lại sau.";
                voucherMessage.style.color = "#e74c3c";
            }
        });
    }
    
    function copyVoucherCode() {
        const voucherCode = voucherCodeSpan.textContent;
        navigator.clipboard.writeText(voucherCode).then(() => {
            // Show success message
            const originalText = copyVoucherBtn.innerHTML;
            copyVoucherBtn.innerHTML = '<i class="fas fa-check"></i>';
            
            setTimeout(() => {
                copyVoucherBtn.innerHTML = originalText;
            }, 2000);
        });
    }
    
    function shareResults() {
        // Share result on social media or via email
        const text = `Tôi vừa hoàn thành bài quiz công nghệ với số điểm ${score}/${quizQuestions.length} và nhận được voucher giảm giá! Thử sức bạn tại: ${window.location.href}`;
        
        // Check if Web Share API is supported
        if (navigator.share) {
            navigator.share({
                title: 'Kết quả Quiz Công Nghệ',
                text: text,
                url: window.location.href
            })
            .catch(error => console.log('Lỗi khi chia sẻ:', error));
        } else {
            // Fallback - Open new window with share link
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
        }
    }
    
    // Function to create confetti celebration
    function createConfetti() {
        const confettiContainer = document.querySelector('.confetti-container');
        const colors = ['#4a89dc', '#3cb878', '#f39c12', '#9b59b6', '#e74c3c', '#1abc9c'];
        const confettiCount = 150;
        
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            
            // Random position, rotation, color and size
            const size = Math.random() * 10 + 5;
            const positionLeft = Math.random() * 100;
            const positionTop = Math.random() * 100;
            const rotation = Math.random() * 360;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            // Add styles
            confetti.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                background-color: ${color};
                top: ${positionTop}%;
                left: ${positionLeft}%;
                opacity: 0;
                transform: rotate(${rotation}deg);
                animation: confetti-fall 3s ease-in-out forwards;
                animation-delay: ${Math.random() * 2}s;
            `;
            
            confettiContainer.appendChild(confetti);
        }
        
        // Clean up confetti after animation completes
        setTimeout(() => {
            while (confettiContainer.firstChild) {
                confettiContainer.removeChild(confettiContainer.firstChild);
            }
        }, 5000);
    }
}); 