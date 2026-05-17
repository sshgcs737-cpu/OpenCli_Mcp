clc; clear; close all;

%% 系统参数设置
Rb = 5e4;                       % 速率：50Kb/s
Tb = 1 / Rb;                    % bit间隔
hopping = 1000;                 % 跳频速率1000h/s
bitsPerHop = Rb / hopping;      % 每跳bit数目（必须为整数）50
samp = 20;                      % 过采样倍数
fs = samp * Rb;                 % 采样率
BW = 5e6;                       % 跳频带宽
freqNum = floor(BW / (Rb * 4)); % 跳频频点数目（乘4可能是为了频点数量）25
freqInterval = BW / freqNum;    % 频点间隔 200,000
freqSeq = ([0:freqNum-1] - floor(freqNum/2)) * freqInterval; % 跳频频点序列 （对称）
carrier = 3e6;                  % 跳频中心频率
carrierSeq = carrier + freqSeq; % 发送时跳频频点序列 中心频率从0变为3e6

%% 传输信息参数设置
SYNC_BIT_NUM = 40;                      % 同步bit数目
MSG_BIT_NUM = 1024;                     % 消息bit数目
TX_BIT_NUM = SYNC_BIT_NUM + MSG_BIT_NUM;% 需要发送的bit数目
HOP_NUM = ceil(TX_BIT_NUM / bitsPerHop);% 发送所有的bit需要的跳频点数 22
EXCEED_BIT = HOP_NUM * bitsPerHop - TX_BIT_NUM; % 多余的bit

%% 构造发送序列
SYNC = randi([0, 1], 1, SYNC_BIT_NUM);  % 同步二进制序列（用一串随机序列代替）
MSG = randi([0, 1], 1, HOP_NUM * bitsPerHop - SYNC_BIT_NUM); % 消息字符号
TX_BIT = [SYNC, MSG];                   % 构造整个发送bit序列
TX_BIT_MAT = reshape(TX_BIT, bitsPerHop, HOP_NUM); % 将待发送序列转成一个矩阵
TX_BIT_MAT = TX_BIT_MAT';                % 行：跳数，列: 每跳对应的bit序列

%% 调制
[biNRZ, msgModMatrix] = MSKmodulator(samp, TX_BIT_MAT); % 复基带调制矩阵



%% 误比特参数设置
frameNum = 500;                % 传输帧数目
snr = -5:10;                    % 信噪比
ber = zeros(1, length(snr));    % 误比特率

%% 带限干扰参数设置
sys.NOISE_POWER = 20;           % 干扰功率(dbm)
Hd.filtDelay = 5;               % 滤波器延迟
Hd.Hd = fir1(32, 0.5);          % FIR滤波器设计



%% 误比特分析
for ii = 1:length(snr)
    sumErrBit = 0;
    for jj = 1:frameNum
        % 跳频
        fhIndex = randi([1, freqNum], 1, HOP_NUM); % 生成随机频点序列索引
        txFHtable = carrierSeq(fhIndex);            % 生成跳频频点
        txFHmodulatedMat = FHmodulator(samp, msgModMatrix, txFHtable, fs); % 跳频后的信号

        % 信道
        txFHmodulated = reshape(txFHmodulatedMat', 1, numel(txFHmodulatedMat)); % 转化为1维信号
        rcvNoisy = awgn(txFHmodulated, snr(ii)); % 添加高斯白噪声

        
        % 添加带限噪声
        noiseLen = length(rcvNoisy);
        noise = wgnGen(sys, Hd, noiseLen);
        noise = noise';
        rcvNoisy1 = rcvNoisy + noise;
        rcvNoisyMat = reshape(rcvNoisy, numel(txFHmodulatedMat) / HOP_NUM, HOP_NUM); % 还原为矩阵形式
        rcvNoisyMat = rcvNoisyMat';

        % 解跳
        rcvBBmat = FHdemodulator(samp, rcvNoisyMat, txFHtable, fs);

        % 差分解调
        rcvBB1dim = reshape(rcvBBmat', 1, numel(rcvBBmat));
        rcvBBsamp = reshape(rcvBB1dim, samp, numel(rcvBB1dim) / samp);
        dmdBit = imag(conj(rcvBBsamp(samp, :)) .* rcvBBsamp(1, :)) > 0;
        dmdBit = dmdBit(1:end-EXCEED_BIT);
        orignalBit = TX_BIT(1:end-EXCEED_BIT);

        % 计算误bit数
        errBitNum = sum(orignalBit ~= dmdBit);
        sumErrBit = sumErrBit + errBitNum;
    end
    % 计算误bit率
    ber(ii) = sumErrBit / (frameNum * TX_BIT_NUM);
end

%% 误比特率曲线



%% 写入文件以及作图

%基带信号(双极性不归零码)
    biNRZdim = reshape(biNRZ' , 1 ,numel(biNRZ));

%     fileId_NRZ=fopen('NRZdim.txt','w');
%     for i=1:length(biNRZdim)
%         fprintf(fileId_NRZ, '%g\n', biNRZdim(i));
%     end
%     fclose(fileId_NRZ);

    % 采样基带信号以绘制方波
    sampled_biNRZ = biNRZdim(1:samp:end);
    sampled_biNRZ_partial = sampled_biNRZ(1:20);
    BIT_NUM=length(sampled_biNRZ_partial);
    
    % 生成对应的时间序列
    time = 0:Tb/samp:Tb*BIT_NUM-Tb/samp;
    MSG_expanded = kron(sampled_biNRZ_partial, ones(1, samp)); 
    

%%
%MSK最小相移键控调制信号

    msgMod = reshape(msgModMatrix' , 1 ,numel(msgModMatrix));
%         fileId_msk=fopen('mskdim.txt','w');
%     for i=1:length(msgMod)
%         fprintf(fileId_msk, '%f %f\n', real(msgMod(i)) ,imag(msgMod(i)));
%     end
%     fclose(fileId_msk);
    % 计算信号的频谱
    N = length(msgMod); % 信号长度
    freq = (0:N-1) * fs / N; % 构建频率轴
    msgMod_fft = fft(msgMod); % 对信号进行FFT变换
    msgMod_fft_shifted = fftshift(msgMod_fft); % 将FFT结果进行频移
    
    % 绘制频谱图

%%
%跳频信号
%         fileId_FH=fopen('FHdim.txt','w');
%     for i=1:length(txFHmodulated)
%         fprintf(fileId_FH, '%f %f\n', real(txFHmodulated(i)) ,imag(txFHmodulated(i)));
%     end
%     fclose(fileId_FH);

    % 计算跳频调制后信号的频谱
    txFHmodulated_fft = fft(txFHmodulated);
    txFHmodulated_fft_shifted = fftshift(txFHmodulated_fft);
    % 计算频谱的频率轴
    N = length(txFHmodulated); % 信号长度
    freq = (0:N-1) * fs / N;    % 构建频率轴
    
    % 绘制频谱图

%%
%加入噪声和干扰信号
% 
%         fileId_jam=fopen('jamdim.txt','w');
%     for i=1:length(rcvNoisy)
%         fprintf(fileId_jam, '%f %f\n', real(rcvNoisy(i)) ,imag(rcvNoisy(i)));
%     end
%     fclose(fileId_jam);

  
    rcvNoisy_fft = fft(rcvNoisy);
    rcvNoisy_fft_shifted = fftshift(rcvNoisy_fft);
    
    N = length(rcvNoisy); % 信号长度
    freq = (0:N-1) * fs / N;    % 构建频率轴
    
    % 绘制频谱图


%%
%解跳信号

% 
%         fileId_unjump=fopen('unjpdim.txt','w');
%     for i=1:length(rcvBB1dim)
%         fprintf(fileId_unjump, '%f %f\n', real(rcvBB1dim(i)) ,imag(rcvBB1dim(i)));
%     end
%     fclose(fileId_unjump);

  
    rcvBB1dim_fft = fft(rcvBB1dim);
    rcvBB1dim_fft_shifted = fftshift(rcvBB1dim_fft);
    
    N = length(rcvBB1dim); % 信号长度
    freq = (0:N-1) * fs / N;    % 构建频率轴
    
    % 绘制频谱图

%%
%差分解调
% fileId_dmd=fopen('dmddim.txt','w');
% for i=1:length(dmdBit)
%     fprintf(fileId_dmd, '%g\n', dmdBit(i));
% end
% fclose(fileId_dmd);

    % 采样基带信号以绘制方波
    sampled_dmdbit_partial = dmdBit(1:20);
    BIT_NUM=length(sampled_dmdbit_partial);
    
    % 生成对应的时间序列
    time = 0:Tb/samp:Tb*BIT_NUM-Tb/samp;
    MSG_expanded1 = kron(sampled_dmdbit_partial, ones(1, samp)); 
    

%信噪比与误码率
%%
% fileID_bertosnr = fopen('bertosnr_wgnGen.txt', 'w');
%     for i=1:length(snr)
%         fprintf(fileID_bertosnr, '%d %f\n', snr(i), ber(i));
%     end
% fclose(fileID_bertosnr);
    hfig = figure('Visible','on','Position', [20, 70, 1500, 700]);

    subplot(2,4,1);
    plot(time, MSG_expanded, 'b', 'LineWidth', 1); % 绘制方波信号
    title('Partial baseband signal');
    xlabel('Time (s)');
    ylabel('Amplitude');
    ylim([-1.2, 1.2]);
    grid on;

    subplot(2,4,2);
    plot(freq, abs(msgMod_fft_shifted));
    xlabel('Frequency (Hz)');
    ylabel('Magnitude');
    title('Frequency Spectrum of MSK Modulated Signal');
    grid on;

    subplot(2,4,3);
    plot(freq, abs(txFHmodulated_fft_shifted));
    xlabel('Frequency (Hz)');
    ylabel('Magnitude');
    title('Frequency Spectrum of FH Modulated Signal');
    grid on;

    subplot(2,4,4);
    plot(freq, abs(rcvNoisy_fft_shifted));
    xlabel('Frequency (Hz)');
    ylabel('Magnitude');
    title('Frequency Spectrum of via channel');
    grid on;
    
    subplot(2,4,5);
    plot(freq, abs(rcvBB1dim_fft_shifted));
    xlabel('Frequency (Hz)');
    ylabel('Magnitude');
    title('Frequency Spectrum of Unjump signal');
    grid on;

    subplot(2,4,6);
    plot(time, MSG_expanded1, 'b', 'LineWidth', 1); % 绘制方波信号
    title('Partial demodulation signal');
    xlabel('Time (s)');
    ylabel('Amplitude');
    ylim([-0.2, 1.2]);
    grid on;

    subplot(2,4,7);
    semilogy(snr, ber, 'm-*');
    xlabel('SNR/dB');
    ylabel('ber');
    grid on;
    title('Bit error rate curve');

    

    
%% 在线干扰
    

for ii = 1:length(snr)
    sumErrBit = 0;
    for jj = 1:frameNum
        % 跳频
        fhIndex = randi([1, freqNum], 1, HOP_NUM); % 生成随机频点序列索引
        txFHtable = carrierSeq(fhIndex);            % 生成跳频频点
        txFHmodulatedMat = FHmodulator(samp, msgModMatrix, txFHtable, fs); % 跳频后的信号

        % 信道
        txFHmodulated = reshape(txFHmodulatedMat', 1, numel(txFHmodulatedMat)); % 转化为1维信号
        rcvNoisy = awgn(txFHmodulated, snr(ii)); % 添加高斯白噪声

        
        % 添加带限噪声
        noiseLen = length(rcvNoisy);
        noise = wgnGen(sys, Hd, noiseLen);
        noise = noise';
        rcvNoisy1 = rcvNoisy + noise;
        rcvNoisyMat = reshape(rcvNoisy1, numel(txFHmodulatedMat) / HOP_NUM, HOP_NUM); % 还原为矩阵形式
        rcvNoisyMat = rcvNoisyMat';

        % 解跳
        rcvBBmat = FHdemodulator(samp, rcvNoisyMat, txFHtable, fs);

        % 差分解调
        rcvBB1dim = reshape(rcvBBmat', 1, numel(rcvBBmat));
        rcvBBsamp = reshape(rcvBB1dim, samp, numel(rcvBB1dim) / samp);
        dmdBit = imag(conj(rcvBBsamp(samp, :)) .* rcvBBsamp(1, :)) > 0;
        dmdBit = dmdBit(1:end-EXCEED_BIT);
        orignalBit = TX_BIT(1:end-EXCEED_BIT);

        % 计算误bit数
        errBitNum = sum(orignalBit ~= dmdBit);
        sumErrBit = sumErrBit + errBitNum;
    end
    % 计算误bit率
    ber(ii) = sumErrBit / (frameNum * TX_BIT_NUM);
end

%% 误比特率曲线



%% 写入文件以及作图

%基带信号(双极性不归零码)
    biNRZdim = reshape(biNRZ' , 1 ,numel(biNRZ));

%     fileId_NRZ=fopen('NRZdim.txt','w');
%     for i=1:length(biNRZdim)
%         fprintf(fileId_NRZ, '%g\n', biNRZdim(i));
%     end
%     fclose(fileId_NRZ);

    % 采样基带信号以绘制方波
    sampled_biNRZ = biNRZdim(1:samp:end);
    sampled_biNRZ_partial = sampled_biNRZ(1:20);
    BIT_NUM=length(sampled_biNRZ_partial);
    
    % 生成对应的时间序列
    time = 0:Tb/samp:Tb*BIT_NUM-Tb/samp;
    MSG_expanded = kron(sampled_biNRZ_partial, ones(1, samp)); 
    

%%
%MSK最小相移键控调制信号

    msgMod = reshape(msgModMatrix' , 1 ,numel(msgModMatrix));
%         fileId_msk=fopen('mskdim.txt','w');
%     for i=1:length(msgMod)
%         fprintf(fileId_msk, '%f %f\n', real(msgMod(i)) ,imag(msgMod(i)));
%     end
%     fclose(fileId_msk);
    % 计算信号的频谱
    N = length(msgMod); % 信号长度
    freq = (0:N-1) * fs / N; % 构建频率轴
    msgMod_fft = fft(msgMod); % 对信号进行FFT变换
    msgMod_fft_shifted = fftshift(msgMod_fft); % 将FFT结果进行频移
    
    % 绘制频谱图

%%
%跳频信号
%         fileId_FH=fopen('FHdim.txt','w');
%     for i=1:length(txFHmodulated)
%         fprintf(fileId_FH, '%f %f\n', real(txFHmodulated(i)) ,imag(txFHmodulated(i)));
%     end
%     fclose(fileId_FH);

    % 计算跳频调制后信号的频谱
    txFHmodulated_fft = fft(txFHmodulated);
    txFHmodulated_fft_shifted = fftshift(txFHmodulated_fft);
    % 计算频谱的频率轴
    N = length(txFHmodulated); % 信号长度
    freq = (0:N-1) * fs / N;    % 构建频率轴
    
    % 绘制频谱图

%%
%加入噪声和干扰信号
% 
%         fileId_jam=fopen('jamdim.txt','w');
%     for i=1:length(rcvNoisy)
%         fprintf(fileId_jam, '%f %f\n', real(rcvNoisy(i)) ,imag(rcvNoisy(i)));
%     end
%     fclose(fileId_jam);

  
    rcvNoisy_fft = fft(rcvNoisy);
    rcvNoisy_fft_shifted = fftshift(rcvNoisy_fft);
    
    N = length(rcvNoisy); % 信号长度
    freq = (0:N-1) * fs / N;    % 构建频率轴
    
    % 绘制频谱图


%%
%解跳信号

% 
%         fileId_unjump=fopen('unjpdim.txt','w');
%     for i=1:length(rcvBB1dim)
%         fprintf(fileId_unjump, '%f %f\n', real(rcvBB1dim(i)) ,imag(rcvBB1dim(i)));
%     end
%     fclose(fileId_unjump);

  
    rcvBB1dim_fft = fft(rcvBB1dim);
    rcvBB1dim_fft_shifted = fftshift(rcvBB1dim_fft);
    
    N = length(rcvBB1dim); % 信号长度
    freq = (0:N-1) * fs / N;    % 构建频率轴
    
    % 绘制频谱图

%%
%差分解调
% fileId_dmd=fopen('dmddim.txt','w');
% for i=1:length(dmdBit)
%     fprintf(fileId_dmd, '%g\n', dmdBit(i));
% end
% fclose(fileId_dmd);

    % 采样基带信号以绘制方波
    sampled_dmdbit_partial = dmdBit(1:20);
    BIT_NUM=length(sampled_dmdbit_partial);
    
    % 生成对应的时间序列
    time = 0:Tb/samp:Tb*BIT_NUM-Tb/samp;
    MSG_expanded1 = kron(sampled_dmdbit_partial, ones(1, samp)); 
    

%信噪比与误码率
%%
% fileID_bertosnr = fopen('bertosnr_wgnGen.txt', 'w');
%     for i=1:length(snr)
%         fprintf(fileID_bertosnr, '%d %f\n', snr(i), ber(i));
%     end
% fclose(fileID_bertosnr);
    hfig2 = figure('Visible','off','Position', [20, 70, 1500, 700]);

    subplot(2,4,1);
    plot(time, MSG_expanded, 'b', 'LineWidth', 1); % 绘制方波信号
    title('Partial baseband signal');
    xlabel('Time (s)');
    ylabel('Amplitude');
    ylim([-1.2, 1.2]);
    grid on;

    subplot(2,4,2);
    plot(freq, abs(msgMod_fft_shifted));
    xlabel('Frequency (Hz)');
    ylabel('Magnitude');
    title('Frequency Spectrum of MSK Modulated Signal');
    grid on;

    subplot(2,4,3);
    plot(freq, abs(txFHmodulated_fft_shifted));
    xlabel('Frequency (Hz)');
    ylabel('Magnitude');
    title('Frequency Spectrum of FH Modulated Signal');
    grid on;

    subplot(2,4,4);
    plot(freq, abs(rcvNoisy_fft_shifted));
    xlabel('Frequency (Hz)');
    ylabel('Magnitude');
    title('Frequency Spectrum of jamming Signal');
    grid on;
    
    subplot(2,4,5);
    plot(freq, abs(rcvBB1dim_fft_shifted));
    xlabel('Frequency (Hz)');
    ylabel('Magnitude');
    title('Frequency Spectrum of Unjump signal');
    grid on;

    subplot(2,4,6);
    plot(time, MSG_expanded1, 'b', 'LineWidth', 1); % 绘制方波信号
    title('Partial demodulation signal');
    xlabel('Time (s)');
    ylabel('Amplitude');
    ylim([-0.2, 1.2]);
    grid on;

    subplot(2,4,7);
    semilogy(snr, ber, 'm-*');
    xlabel('SNR/dB');
    ylabel('ber');
    grid on;
    title('Bit error rate curve');
    
